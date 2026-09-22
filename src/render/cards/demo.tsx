/**
 * The Phase 0 demo card. Exercises every building block of the design system
 * (header, tier thumbnail, meters, icon grid, number formatting, name fitting,
 * placeholders) and is the prototype of the Phase 1 base card.
 *
 * The view model holds display-ready facts; this file only lays them out.
 */
import { abbrev, duration, perHour } from "../../ui/format";
import {
  color,
  layout,
  type Tier,
  tierColor,
  toneColor,
  toneForFill,
  toneForRemaining,
  withAlpha,
} from "../../ui/theme";
import { Bar, CardFrame, Col, Divider, Fit, Icon, Label, Row } from "../components";
import type { Child } from "../jsx-runtime";
import { type CardDef, useRender } from "../renderer";

export interface Meter {
  value: number;
  max: number;
}

export interface ResourceCell {
  /** Resource id: icon name and locale key. */
  id: string;
  amount: number;
  perHour: number;
}

export interface DemoCardProps {
  playerName: string;
  tier: Tier;
  seasonDay: number;
  scrap: number;
  storage: Meter;
  /** Seconds of upkeep left against a 72 h scale. `null`: the tier has no upkeep. */
  upkeep: Meter | null;
  /** Only resources the player has discovered, so a new base is not a wall of zeroes. */
  resources: ResourceCell[];
  tool: { id: string; tier: Tier };
}

const COLUMNS = 3;
const GAP = 12;
const CELL_WIDTH = (layout.cardWidth - layout.pad * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
const CELL_HEIGHT = 88;

const fraction = (meter: Meter) =>
  meter.max > 0 ? Math.min(1, Math.max(0, meter.value / meter.max)) : 0;

function Cell({ outline, children }: { outline?: string; children?: Child }) {
  return (
    <Row
      style={{
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
        padding: "0 12px",
        alignItems: "center",
        borderRadius: 12,
        backgroundColor: color.panel,
        border: `2px solid ${outline ?? color.panel}`,
      }}
    >
      {children}
    </Row>
  );
}

function Resource({ cell }: { cell: ResourceCell }) {
  const { locale } = useRender();
  const empty = cell.amount === 0;
  return (
    <Cell>
      <Icon folder="icons_256" name={cell.id} size={52} dim={empty} />
      <Col style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
        <Row style={{ alignItems: "baseline", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              color: empty ? color.muted : color.text,
            }}
          >
            {abbrev(cell.amount)}
          </div>
          {cell.perHour !== 0 ? (
            <div style={{ display: "flex", color: color.muted }}>{perHour(cell.perHour)}</div>
          ) : null}
        </Row>
        <Fit style={{ color: color.muted, marginTop: 2 }}>
          {locale.t(`resource.${cell.id}.name`)}
        </Fit>
      </Col>
    </Cell>
  );
}

/** What drives every rate in the grid. Outlined in its tier colour. */
function Tool({ tool }: { tool: DemoCardProps["tool"] }) {
  const { locale } = useRender();
  const tint = tierColor[tool.tier];
  return (
    <Cell outline={withAlpha(tint, 0.6)}>
      <Icon folder="icons_256" name={tool.id} size={52} tier={tool.tier} />
      <Col style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
        <Fit style={{ fontSize: 24, fontWeight: 700, lineHeight: "34px" }}>
          {locale.t(`tool.${tool.id}.name`)}
        </Fit>
        <Fit style={{ color: tint, marginTop: 2 }}>{locale.t("card.demo.tool")}</Fit>
      </Col>
    </Cell>
  );
}

function Demo(props: DemoCardProps) {
  const { locale } = useRender();
  const tint = tierColor[props.tier];
  const storage = fraction(props.storage);
  const storageTone = toneColor[toneForFill(storage)];
  const upkeep = props.upkeep ? fraction(props.upkeep) : 0;
  const upkeepTone = toneColor[toneForRemaining(upkeep)];

  return (
    <CardFrame>
      {/* Header: tier thumbnail, name, tier line; scrap on the right. */}
      <Row style={{ alignItems: "center" }}>
        <Icon folder="thumbs_512" name={`tier_${props.tier}`} size={84} tier={props.tier} />
        <Col style={{ flex: 1, minWidth: 0, marginLeft: 20, marginRight: 24 }}>
          <Fit style={{ fontSize: 38, fontWeight: 700, lineHeight: "46px" }}>
            {props.playerName}
          </Fit>
          <Fit style={{ fontSize: 24, color: tint }}>
            {locale.t("card.demo.subtitle", {
              tier: locale.t(`base_tier.${props.tier}.name`),
              day: props.seasonDay,
            })}
          </Fit>
        </Col>
        <Col style={{ alignItems: "flex-end" }}>
          <Row style={{ alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                fontSize: 38,
                fontWeight: 700,
                lineHeight: "46px",
                marginRight: 12,
              }}
            >
              {abbrev(props.scrap)}
            </div>
            <Icon folder="icons_256" name="scrap" size={44} />
          </Row>
          <Label>{locale.t("resource.scrap.name")}</Label>
        </Col>
      </Row>

      <Col style={{ marginTop: 22, marginBottom: 22 }}>
        <Divider />
      </Col>

      {/* Storage: the check-in driver, so it gets the biggest bar. */}
      <Row style={{ alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <Label>{locale.t("card.demo.storage")}</Label>
        {storage >= 1 ? (
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: color.danger }}>
            {locale.t("card.demo.storage_full")}
          </div>
        ) : (
          <Row style={{ alignItems: "baseline", fontSize: 28 }}>
            <div style={{ display: "flex", fontWeight: 700 }}>{abbrev(props.storage.value)}</div>
            <div style={{ display: "flex", color: color.muted, marginLeft: 8 }}>
              {`/ ${abbrev(props.storage.max)}`}
            </div>
          </Row>
        )}
      </Row>
      <Bar fraction={storage} tone={storageTone} height={20} />

      {/* Resource grid: amount and rate on the first line, name on the second, so a
          cell is identifiable even when its icon is a placeholder. The tool tile closes it. */}
      <Row style={{ flexWrap: "wrap", gap: GAP, marginTop: 26 }}>
        {props.resources.map((cell) => (
          <Resource cell={cell} />
        ))}
        <Tool tool={props.tool} />
      </Row>

      {/* Upkeep. Tiers without upkeep (twig) get no section at all. */}
      {props.upkeep ? (
        <Col style={{ marginTop: 26 }}>
          <Row
            style={{ alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}
          >
            <Label>{locale.t("card.demo.upkeep")}</Label>
            <div
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 700,
                color: props.upkeep.value <= 0 ? color.danger : upkeepTone,
              }}
            >
              {props.upkeep.value <= 0
                ? locale.t("card.demo.upkeep_decaying")
                : locale.t("card.demo.upkeep_left", { time: duration(props.upkeep.value) })}
            </div>
          </Row>
          <Bar fraction={upkeep} tone={upkeepTone} height={12} />
        </Col>
      ) : null}
    </CardFrame>
  );
}

export const demoCard: CardDef<DemoCardProps> = { id: "demo", render: Demo };
