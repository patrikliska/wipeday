import { gearOf, heldDrops, topTier } from "@wipe-day/domain/cards";
import type { DropCard } from "@wipe-day/domain/events";
import { flippedCount, useReveal } from "../state/reveal";
import { useWorld } from "../state/store";
import { useUi } from "../state/ui";
import { content, crewName, t } from "../state/world";
import { Bust, GearArt, gearName, rarityName, rarityStyle } from "./cards";
import { Icon } from "./Icon";
import { SheetFrame } from "./Sheet";

/*
 * The reveal (12-feel.md 7.1; D261): a Supply Drop's three cards face down on a sheet. A tap on
 * a card, or "Flip the next", turns one over: its rarity colour glows first, then the face. A new
 * card wears NEW; a card already owned shows the shards it paid (N28: never blank). "To the
 * Album" is always one tap away; after the last card the primary opens the next held drop, or
 * goes to the Album when none is left. Reduced motion shows the faces without the turn.
 */
export function RevealSheet() {
  const sheet = useUi((state) => state.sheet);
  const openSheet = useUi((state) => state.openSheet);
  const tier = useReveal((state) => state.tier);
  const cards = useReveal((state) => state.cards);
  const up = useReveal((state) => state.up);
  const drops = useWorld((state) => state.base?.meta.drops ?? null);
  if (sheet !== "reveal" || tier === null || !drops) return null;
  const flipped = flippedCount(up);
  const all = flipped >= cards.length;
  const held = heldDrops(drops);
  const next = topTier(drops);
  const { start, flip, finish } = useReveal.getState();
  const primary = !all
    ? t("reveal.flip_next")
    : held > 0 && next !== null
      ? t("reveal.open_next")
      : t("reveal.to_album");
  const onPrimary = () => {
    if (!all) flip();
    else if (held > 0 && next !== null) start(next);
    else finish(true);
  };
  return (
    <SheetFrame
      id="reveal"
      className={`reveal-sheet tier-${tier}`}
      title={t(`drop.tier_${tier}`)}
      head={<p className="sub">{t("reveal.sub", { n: cards.length })}</p>}
      primary={primary}
      onPrimary={onPrimary}
      onClose={() => {
        useReveal.setState({ tier: null, cards: [], up: [] });
        openSheet(null);
      }}
      {...(all && !(held > 0 && next !== null)
        ? {}
        : { secondary: { label: t("reveal.to_album"), onClick: () => finish(true) } })}
    >
      <ul className="reveal-cards">
        {cards.map((card, i) => (
          <RevealCard
            // biome-ignore lint/suspicious/noArrayIndexKey: the three slots are positional
            key={i}
            card={card}
            up={up[i] === true}
            onFlip={() => flip(i)}
          />
        ))}
      </ul>
    </SheetFrame>
  );
}

function RevealCard({ card, up, onFlip }: { card: DropCard; up: boolean; onFlip: () => void }) {
  const gear = card.kind === "gear" ? gearOf(content, card.id) : undefined;
  const name = card.kind === "survivor" ? crewName(card.id) : gearName(card.id);
  const kind = t(`reveal.${card.kind}`);
  return (
    <li
      className={`reveal-card ${card.rarity}${up ? " up" : " down"}`}
      style={rarityStyle(card.rarity)}
    >
      <button
        type="button"
        className="reveal-flip"
        disabled={up}
        aria-label={
          up
            ? t("reveal.card", { rarity: rarityName(card.rarity), kind, name })
            : t("reveal.face_down")
        }
        onClick={onFlip}
      >
        <span className="reveal-back plate" aria-hidden="true">
          <Icon kind="flotsam" id="sealed_locker" size={36} />
        </span>
        <span className="reveal-face plate" aria-hidden={!up}>
          <span className="reveal-strap">{rarityName(card.rarity)}</span>
          {card.kind === "survivor" ? (
            <Bust id={card.id} box={64} />
          ) : gear ? (
            <GearArt def={gear} box={64} />
          ) : null}
          <span className="reveal-name">{name}</span>
          <span className="reveal-kind">
            {gear ? `${t(`slot.${gear.slot}.name`)} · ${kind}` : kind}
          </span>
          {card.fresh ? (
            <span className="reveal-new">{t("reveal.new")}</span>
          ) : (
            <span className="reveal-dupe num">
              <Icon kind="ui" id="shard" size={12} />
              {t("reveal.dupe", { n: card.shards })}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
