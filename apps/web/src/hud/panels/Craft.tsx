/**
 * The recipe browser: one tab per station (plus pinned recipes), each with its
 * queue and its recipes; a recipe opens into what it takes, where each input
 * comes from (with a link to make it), what it is for, and a batch to queue.
 * Every rule shown here comes from the domain (`craft.ts`, `recipes.ts`).
 */
import type { Amounts, Recipe } from "@wipe-day/content/schema";
import { partWorthIt } from "@wipe-day/domain/advisor";
import {
  batchSize,
  type CraftJob,
  type CraftStatus,
  craftOptions,
  craftStatus,
  jobEndsAt,
  maxBatch,
  queueOf,
  queueSlots,
  unitSeconds,
  unitsDone,
} from "@wipe-day/domain/craft";
import {
  expandNeeds,
  knows,
  type Need,
  recipeFor,
  type Source,
  sourcesOf,
  stationLevel,
  stations,
  type Use,
  usesOf,
} from "@wipe-day/domain/recipes";
import { useEffect, useState } from "react";
import { useWorld } from "../../state/store";
import {
  abbrev,
  content,
  duration,
  itemById,
  missingLabel,
  outputName,
  resourceName,
  stationName,
  t,
  tierName,
  toolName,
} from "../../state/world";
import { Cost } from "../Cost";
import { ItemIcon, ResourceIcon } from "../Icon";
import { tierVar, vars } from "../util";

const PINNED = "pinned";
const STORE_KEY = "wipeday.pinned";

/** Pinned recipes are a view preference: kept per device. */
function usePinned(): [string[], (output: string) => void] {
  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
      return Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(pinned));
    } catch {
      // Private windows: pins last for this visit only.
    }
  }, [pinned]);
  const toggle = (output: string) =>
    setPinned((list) =>
      list.includes(output) ? list.filter((id) => id !== output) : [...list, output],
    );
  return [pinned, toggle];
}

/** Craftable first, then what only lacks resources, then what is locked. */
const RANK: Record<CraftStatus["code"], number> = {
  ok: 0,
  unaffordable: 1,
  queue_full: 2,
  batch: 2,
  box_slots: 3,
  workbench: 4,
  station: 5,
  blueprint: 6,
  owned: 7,
  unknown: 8,
};

/** The button words for a recipe's status: what it does, or why it cannot. */
function statusLabel(status: CraftStatus, time: string, count: number): string {
  switch (status.code) {
    case "ok":
      return count > 1 ? t("craft.make_count", { count, time }) : t("craft.queue", { time });
    case "unaffordable":
      return t("craft.need", { need: missingLabel(status.missing) ?? "" });
    case "workbench":
      return t("craft.needs_level", { station: stationName(status.station), level: status.needed });
    case "station":
      return t("craft.needs_station", { station: stationName(status.station) });
    case "blueprint":
      return t("craft.blueprint");
    case "owned":
      return t("craft.owned");
    case "box_slots":
      return t("craft.no_slots", { slots: status.slots });
    case "queue_full":
      return t("craft.queue_full");
    case "batch":
      return t("craft.batch_max", { size: status.size });
    case "unknown":
      return t("refusal.unknown");
  }
}

function OutputIcon({ id }: { id: string }) {
  return itemById.has(id) ? <ItemIcon id={id} /> : <ResourceIcon id={id} />;
}

/** What one recipe unit is: "Makes 10" for parts, the item's line for items. */
function blurb(recipe: Recipe): string {
  const item = itemById.get(recipe.output);
  if (!item) return t("craft.makes", { amount: recipe.amount });
  return t(`item.${item.id}.effect`, {
    capacity: item.capacity ?? 0,
    percent: item.boostPercent ?? 0,
    hours: item.hours ?? 0,
  });
}

export function CraftPanel() {
  const station = useWorld((state) => state.station);
  const recipe = useWorld((state) => state.recipe);
  const [pinned, togglePin] = usePinned();
  const open = recipe ? recipeFor(content, recipe) : undefined;
  return (
    <>
      <StationTabs current={open ? open.station : station} hasPinned={pinned.length > 0} />
      {open ? (
        <RecipeDetail
          key={open.output}
          recipe={open}
          pinned={pinned.includes(open.output)}
          onPin={togglePin}
        />
      ) : (
        <StationView station={station} pinned={pinned} />
      )}
    </>
  );
}

function StationTabs({ current, hasPinned }: { current: string; hasPinned: boolean }) {
  const base = useWorld((state) => state.base);
  const select = useWorld((state) => state.selectStation);
  const tabs = [...(hasPinned ? [PINNED] : []), ...stations(content)];
  return (
    <div className="tabs" role="tablist">
      {tabs.map((id) => {
        const busy = id !== PINNED && queueOf(base, id).length > 0;
        const built = id === PINNED || stationLevel(base, id) > 0;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={current === id}
            className={`tab${current === id ? " on" : ""}${built ? "" : " dim"}`}
            onClick={() => select(id)}
            title={busy ? t("craft.making") : undefined}
          >
            {id === PINNED ? t("craft.tab_pinned") : stationName(id)}
            {busy ? <i className="dot" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function StationView({ station, pinned }: { station: string; pinned: string[] }) {
  const base = useWorld((state) => state.base);
  const openPanel = useWorld((state) => state.openPanel);
  const openRecipe = useWorld((state) => state.openRecipe);
  const craft = useWorld((state) => state.craft);
  const showing = station === PINNED;
  const options = (
    showing
      ? craftOptions(content, base).filter((option) => pinned.includes(option.recipe.output))
      : craftOptions(content, base, station)
  ).sort((a, b) => RANK[a.status.code] - RANK[b.status.code]);
  // One primary: the part the next tier or tool waits on, else the first thing makeable.
  const wanted = partWorthIt(content, base)?.output;
  const primary =
    options.find((option) => option.recipe.output === wanted && option.status.code === "ok")?.recipe
      .output ?? options.find((option) => option.status.code === "ok")?.recipe.output;
  const level = showing ? 0 : stationLevel(base, station);

  return (
    <>
      {showing ? null : level > 0 ? (
        <p className="hint">
          {t("craft.station_line", {
            level,
            used: queueOf(base, station).length,
            slots: queueSlots(content, base, station),
            batch: batchSize(content, base, station),
          })}
        </p>
      ) : (
        <div className="row">
          <span className="hint grow">
            {t("craft.station_missing", { station: stationName(station) })}
          </span>
          <button type="button" className="btn small" onClick={() => openPanel("build")}>
            {t("craft.open_build")}
          </button>
        </div>
      )}
      {showing ? null : <Queue station={station} />}
      {options.length === 0 ? <p className="hint">{t("craft.pinned_empty")}</p> : null}
      {options.map(({ recipe, status }) => {
        const item = itemById.get(recipe.output);
        const locked = ["workbench", "station", "blueprint", "owned"].includes(status.code);
        const have = item ? (base.items[item.id] ?? 0) : Math.floor(base.stock[recipe.output] ?? 0);
        const time = duration(unitSeconds(content, base, recipe));
        return (
          <div
            key={recipe.output}
            className={`card${locked ? " locked" : ""}`}
            style={vars({ "--tier-color": item ? tierVar(item.tier) : "var(--muted)" })}
          >
            <OutputIcon id={recipe.output} />
            <div className="main">
              <button
                type="button"
                className="title link"
                onClick={() => openRecipe(recipe.output)}
              >
                <b>{outputName(recipe.output)}</b>
                <span className="lvl">
                  {recipe.blueprint && knows(base, recipe)
                    ? t("craft.blueprint_tag")
                    : have > 0
                      ? t("craft.owned_count", { count: abbrev(have) })
                      : item
                        ? t(`category.${item.category}`)
                        : t("craft.part")}
                </span>
              </button>
              <div className="desc">{blurb(recipe)}</div>
              {status.code === "blueprint" ? null : <Cost cost={recipe.cost} stock={base.stock} />}
              <div className="row">
                <button
                  type="button"
                  className={`btn grow${recipe.output === primary ? " primary" : ""}`}
                  disabled={status.code !== "ok"}
                  onClick={() => craft(recipe.output, 1)}
                >
                  {statusLabel(status, time, 1)}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => openRecipe(recipe.output)}
                  aria-label={t("craft.details", { item: outputName(recipe.output) })}
                >
                  {t("craft.more")}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** A station's jobs: the running one with its progress, the waiting ones, each cancellable. */
function Queue({ station }: { station: string }) {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now));
  const cancel = useWorld((state) => state.cancelCraft);
  return (
    <>
      {queueOf(base, station).map((job: CraftJob, index) => {
        const done = unitsDone(job, now);
        const started = now >= job.startedAt;
        const progress = started
          ? Math.min(1, (now - job.startedAt) / Math.max(1, job.count * job.unitSeconds))
          : 0;
        const recipe = recipeFor(content, job.recipe);
        return (
          <div key={`${job.recipe}-${job.startedAt}`} className="card">
            <OutputIcon id={job.recipe} />
            <div className="main">
              <div className="title">
                <b>
                  {t("craft.job", {
                    item: outputName(job.recipe),
                    count: abbrev(job.count * (recipe?.amount ?? 1)),
                  })}
                </b>
                <span className="lvl">{started ? t("craft.making") : t("craft.waiting")}</span>
              </div>
              <div className="progress" style={vars({ "--bar-color": "#e3a32f" })}>
                <i style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <div className="row">
                <span className="desc grow">
                  {started
                    ? t("craft.job_progress", {
                        done,
                        count: job.count,
                        time: duration(jobEndsAt(job) - now),
                      })
                    : t("craft.job_waiting", { time: duration(job.startedAt - now) })}
                </span>
                <button type="button" className="btn small" onClick={() => cancel(station, index)}>
                  {t("craft.cancel")}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function useText(use: Use): string {
  switch (use.kind) {
    case "tier":
      return t("craft.used_tier", { tier: tierName(use.tier) });
    case "tool":
      return toolName(use.tool);
    case "building":
      return t("craft.used_building", { building: stationName(use.building), level: use.level });
    case "recipe":
      return outputName(use.output);
  }
}

function sourceText(source: Source): string {
  switch (source.kind) {
    case "recipe":
      return t("craft.source_recipe", { station: stationName(source.recipe.station) });
    case "tool":
      return t("craft.source_tool", { tool: toolName(source.tool) });
    case "building":
      return t("craft.source_building", { building: stationName(source.building) });
    case "furnace":
      return t("craft.source_furnace", { ore: resourceName(source.ore) });
    case "barrel":
      return t("craft.source_barrel");
    case "task":
      return t("craft.source_task");
  }
}

function RecipeDetail({
  recipe,
  pinned,
  onPin,
}: {
  recipe: Recipe;
  pinned: boolean;
  onPin: (output: string) => void;
}) {
  const base = useWorld((state) => state.base);
  const select = useWorld((state) => state.selectStation);
  const craft = useWorld((state) => state.craft);
  const most = maxBatch(content, base, recipe.output);
  const [count, setCount] = useState(1);
  const cap = Math.max(1, batchSize(content, base, recipe.station));
  const units = Math.min(Math.max(1, count), cap);
  const cost: Amounts = {};
  for (const [id, amount] of Object.entries(recipe.cost)) cost[id] = amount * units;
  const status = craftStatus(content, base, recipe.output, units);
  const unit = unitSeconds(content, base, recipe);
  const time = duration(unit * units);
  const uses = usesOf(content, recipe.output);
  const known = knows(base, recipe);
  const left = Object.entries(cost)
    .map(
      ([id, amount]) =>
        `${abbrev(Math.max(0, (base.stock[id] ?? 0) - amount))} ${resourceName(id).toLowerCase()}`,
    )
    .join(", ");

  return (
    <>
      <div className="row">
        <button type="button" className="btn small" onClick={() => select(recipe.station)}>
          {t("craft.back", { station: stationName(recipe.station) })}
        </button>
        <span className="grow" />
        <button
          type="button"
          className="btn small"
          aria-pressed={pinned}
          onClick={() => onPin(recipe.output)}
        >
          {pinned ? t("craft.unpin") : t("craft.pin")}
        </button>
      </div>
      <div className="card">
        <OutputIcon id={recipe.output} />
        <div className="main">
          <div className="title">
            <b>{outputName(recipe.output)}</b>
            <span className="lvl">
              {t("craft.at_station", { station: stationName(recipe.station), level: recipe.level })}
            </span>
          </div>
          <div className="desc">{blurb(recipe)}</div>
          <div className="desc">
            {t("craft.per_unit", { amount: recipe.amount, time: duration(unit) })}
          </div>
        </div>
      </div>

      {uses.length > 0 ? (
        <>
          <h3 className="section">{t("craft.used_for")}</h3>
          <p className="uses">{uses.map(useText).join(" · ")}</p>
        </>
      ) : null}

      <h3 className="section">{t("craft.needs")}</h3>
      {known ? (
        <NeedsTree needs={expandNeeds(content, base.stock, cost)} depth={0} />
      ) : (
        <p className="hint">{t("craft.blueprint_needed")}</p>
      )}

      {known ? (
        <>
          <h3 className="section">{t("craft.how_many")}</h3>
          <div className="row stepper">
            <button
              type="button"
              className="btn"
              disabled={units <= 1}
              onClick={() => setCount(units - 1)}
              aria-label={t("craft.fewer")}
            >
              −
            </button>
            <b className="num count">{units}</b>
            <button
              type="button"
              className="btn"
              disabled={units >= cap}
              onClick={() => setCount(units + 1)}
              aria-label={t("craft.more_units")}
            >
              +
            </button>
            <button
              type="button"
              className="btn grow"
              disabled={most < 1}
              onClick={() => setCount(Math.max(1, most))}
            >
              {t("craft.all_you_can", { count: most })}
            </button>
          </div>
          <p className="hint">
            {t("craft.batch_result", {
              amount: abbrev(units * recipe.amount),
              item: outputName(recipe.output),
              time,
            })}
          </p>
          <Cost cost={cost} stock={base.stock} />
          {status.code === "ok" ? (
            <p className="hint">{t("craft.left_after", { list: left })}</p>
          ) : null}
          <button
            type="button"
            className={`btn wide${status.code === "ok" ? " primary" : ""}`}
            disabled={status.code !== "ok"}
            onClick={() => {
              if (craft(recipe.output, units)) setCount(1);
            }}
          >
            {statusLabel(status, time, units)}
          </button>
        </>
      ) : null}
    </>
  );
}

/** What a cost takes, as a tree: have/need, where each input comes from, a link to make it. */
function NeedsTree({ needs, depth }: { needs: Need[]; depth: number }) {
  const openRecipe = useWorld((state) => state.openRecipe);
  const openPanel = useWorld((state) => state.openPanel);
  return (
    <ul className="needs" style={vars({ "--depth": String(depth) })}>
      {needs.map((need) => {
        const short = need.have < need.need;
        const source = sourcesOf(content, need.id)[0];
        const recipe = source?.kind === "recipe" ? source.recipe : undefined;
        return (
          <li key={need.id}>
            <div className="need">
              <OutputIcon id={need.id} />
              <span className="grow">
                <b>{outputName(need.id)}</b>
                <span className="sub">{source ? sourceText(source) : ""}</span>
              </span>
              <span className={`num${short ? " short" : " ok"}`}>
                {abbrev(Math.min(need.have, need.need))}/{abbrev(need.need)}
              </span>
              {short && recipe ? (
                <button
                  type="button"
                  className="btn small"
                  onClick={() => openRecipe(recipe.output)}
                >
                  {t("craft.make")}
                </button>
              ) : short && source?.kind === "furnace" ? (
                <button type="button" className="btn small" onClick={() => openPanel("furnace")}>
                  {t("panel.furnace")}
                </button>
              ) : null}
            </div>
            {need.parts.length > 0 ? <NeedsTree needs={need.parts} depth={depth + 1} /> : null}
          </li>
        );
      })}
    </ul>
  );
}
