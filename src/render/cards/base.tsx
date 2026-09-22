/**
 * The base overview card: the picture on the home message. Shows what the
 * player *has*: tier, scrap, storage fill, banked resources, current tool.
 * Rates and what is waiting to be collected are text in the message, so the
 * card only changes (and re-renders) when stock changes.
 *
 * Kept wider than tall: desktop Discord scales tall images down to a height
 * cap, so a 4:3 card shows at ~470 px and a square one at ~370 px.
 */
import { abbrev } from "../../ui/format";
import {
  color,
  layout,
  type Tier,
  tierColor,
  toneColor,
  toneForFill,
  withAlpha,
} from "../../ui/theme";
import { Bar, CardFrame, Col, Divider, Fit, Icon, Label, Row } from "../components";
import type { Child } from "../jsx-runtime";
import { type CardDef, useRender } from "../renderer";

export interface BaseCardProps {
  playerName: string;
  tier: Tier;
  seasonDay: number;
  scrap: number;
  storage: { value: number; max: number };
  /** Discovered resources in display order, scrap excluded (it is in the header). */
  resources: Array<{ id: string; amount: number }>;
  tool: { id: string; tier: Tier };
}

const COLUMNS = 4;
const GAP = 10;
const CELL_WIDTH = (layout.cardWidth - layout.pad * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
const CELL_HEIGHT = 76;

function Cell({ children }: { children?: Child }) {
  return (
    <Row
      style={{
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
        padding: "0 10px",
        alignItems: "center",
        borderRadius: 12,
        backgroundColor: color.panel,
      }}
    >
      {children}
    </Row>
  );
}

/** Amount on top, name below: identifiable with zero art. */
function Resource({ id, amount }: { id: string; amount: number }) {
  const { locale } = useRender();
  const empty = amount === 0;
  return (
    <Cell>
      <Icon folder="icons_256" name={id} size={44} dim={empty} />
      <Col style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
        <Fit
          style={{
            fontSize: 28,
            fontWeight: 700,
            lineHeight: "32px",
            color: empty ? color.muted : color.text,
          }}
        >
          {abbrev(amount)}
        </Fit>
        <Fit style={{ color: color.muted, lineHeight: "26px" }}>
          {locale.t(`resource.${id}.name`)}
        </Fit>
      </Col>
    </Cell>
  );
}

/** What drives every rate: a full-width strip so the name never truncates. */
function ToolStrip({ tool }: { tool: BaseCardProps["tool"] }) {
  const { locale } = useRender();
  const tint = tierColor[tool.tier];
  return (
    <Row
      style={{
        height: 56,
        padding: "0 12px",
        alignItems: "center",
        borderRadius: 12,
        backgroundColor: color.panel,
        border: `2px solid ${withAlpha(tint, 0.6)}`,
      }}
    >
      <Icon folder="icons_256" name={tool.id} size={40} tier={tool.tier} />
      <Fit style={{ fontSize: 26, fontWeight: 700, marginLeft: 12 }}>
        {locale.t(`tool.${tool.id}.name`)}
      </Fit>
      <div style={{ display: "flex", flex: 1 }} />
      <Fit style={{ color: tint, marginLeft: 12 }}>{locale.t("card.base.tool")}</Fit>
    </Row>
  );
}

function Base(props: BaseCardProps) {
  const { locale } = useRender();
  const tint = tierColor[props.tier];
  const fill = props.storage.max > 0 ? Math.min(1, props.storage.value / props.storage.max) : 0;
  const fillTone = toneColor[toneForFill(fill)];

  return (
    <CardFrame>
      <Row style={{ alignItems: "center" }}>
        <Icon folder="thumbs_512" name={`tier_${props.tier}`} size={84} tier={props.tier} />
        <Col style={{ flex: 1, minWidth: 0, marginLeft: 20, marginRight: 24 }}>
          <Fit style={{ fontSize: 38, fontWeight: 700, lineHeight: "46px" }}>
            {props.playerName}
          </Fit>
          <Fit style={{ fontSize: 24, color: tint }}>
            {locale.t("card.base.subtitle", {
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

      <Col style={{ marginTop: 18, marginBottom: 18 }}>
        <Divider />
      </Col>

      <Row style={{ alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <Label>{locale.t("card.base.storage")}</Label>
        {fill >= 1 ? (
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: color.danger }}>
            {locale.t("card.base.storage_full")}
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
      <Bar fraction={fill} tone={fillTone} height={20} />

      <Col style={{ marginTop: 18 }}>
        <ToolStrip tool={props.tool} />
      </Col>

      <Row style={{ flexWrap: "wrap", gap: GAP, marginTop: 18 }}>
        {props.resources.map((cell) => (
          <Resource id={cell.id} amount={cell.amount} />
        ))}
      </Row>
    </CardFrame>
  );
}

export const baseCard: CardDef<BaseCardProps> = { id: "base", render: Base };
