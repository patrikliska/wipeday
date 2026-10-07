/**
 * The base card: the picture on `/base`. Shows what the player *has*: the holdfast's tier
 * and season day, scrap, how full the store is, and every gathered resource with its fill.
 * What is waiting, timers and the next step are text in the message (they tick; a PNG
 * cannot), so the card only changes, and re-renders, when the stock changes.
 *
 * Kept wider than tall: desktop Discord scales tall images down to a height cap.
 */
import { abbrev } from "@wipe-day/domain/words";
import { color, layout, type Tier, tierColor, toneColor, toneForFill } from "../../ui/theme";
import { Bar, CardFrame, Col, Divider, Fit, Label, Row, Tile } from "../components";
import type { Child } from "../jsx-runtime";
import type { CardDef } from "../renderer";

/** A resource as the card shows it; names and letters are resolved by the view model. */
export interface CardResource {
  id: string;
  name: string;
  amount: number;
  color: string;
  letters: string;
}

export interface BaseCardProps {
  playerName: string;
  tier: Tier;
  /** "Stone · day 3 of season 1". */
  subtitle: string;
  tierLetters: string;
  scrap: CardResource;
  /** Room per resource. */
  cap: number;
  /** The fullest resource: what the storage bar shows. */
  fullest: { name: string; amount: number };
  /** Gathered and smelted resources in display order, scrap excluded (it is in the header). */
  resources: CardResource[];
  labels: { storage: string; full: string; empty: string };
}

const COLUMNS = 3;
const GAP = 8;
const CELL_WIDTH = (layout.cardWidth - layout.pad * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
const CELL_HEIGHT = 68;

function Cell({ children }: { children?: Child }) {
  return (
    <Row
      style={{
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
        padding: "0 10px",
        alignItems: "center",
        borderRadius: 10,
        backgroundColor: color.panel,
      }}
    >
      {children}
    </Row>
  );
}

/** Amount on top, name below, a hairline fill bar under both. */
function Resource({ resource, cap }: { resource: CardResource; cap: number }) {
  const empty = resource.amount === 0;
  const fill = cap > 0 ? Math.min(1, resource.amount / cap) : 0;
  return (
    <Cell>
      <Tile color={resource.color} label={resource.letters} size={36} dim={empty} />
      <Col style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
        <Fit
          style={{
            fontSize: 30,
            fontWeight: 700,
            lineHeight: "30px",
            color: empty ? color.muted : color.text,
          }}
        >
          {abbrev(resource.amount)}
        </Fit>
        <Fit style={{ fontSize: 24, color: color.muted, lineHeight: "26px" }}>{resource.name}</Fit>
        <Bar fraction={fill} tone={toneColor[toneForFill(fill)]} height={4} />
      </Col>
    </Cell>
  );
}

function Base(props: BaseCardProps) {
  const tint = tierColor[props.tier];
  const fill = props.cap > 0 ? Math.min(1, props.fullest.amount / props.cap) : 0;
  const fillTone = toneColor[toneForFill(fill)];

  return (
    <CardFrame accent={tint}>
      <Row style={{ alignItems: "center" }}>
        <Tile color={tint} label={props.tierLetters} size={68} />
        <Col style={{ flex: 1, minWidth: 0, marginLeft: 16, marginRight: 16 }}>
          <Fit style={{ fontSize: 36, fontWeight: 700, lineHeight: "42px" }}>
            {props.playerName}
          </Fit>
          <Fit style={{ fontSize: 26, color: tint }}>{props.subtitle}</Fit>
        </Col>
        <Col style={{ alignItems: "flex-end" }}>
          <Row style={{ alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                fontSize: 36,
                fontWeight: 700,
                lineHeight: "42px",
                marginRight: 10,
              }}
            >
              {abbrev(props.scrap.amount)}
            </div>
            <Tile color={props.scrap.color} label={props.scrap.letters} size={36} />
          </Row>
          <Label>{props.scrap.name}</Label>
        </Col>
      </Row>

      <Col style={{ marginTop: 16, marginBottom: 14 }}>
        <Divider />
      </Col>

      {/* Storage: the fullest resource is the one that matters. */}
      <Row style={{ alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <Label>{props.labels.storage}</Label>
        {fill >= 1 ? (
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: color.danger }}>
            {props.labels.full}
          </div>
        ) : (
          <Row style={{ alignItems: "baseline", fontSize: 26 }}>
            <div style={{ display: "flex", color: color.muted, marginRight: 10 }}>
              {props.fullest.name}
            </div>
            <div style={{ display: "flex", fontWeight: 700 }}>{abbrev(props.fullest.amount)}</div>
            <div style={{ display: "flex", color: color.muted, marginLeft: 8 }}>
              {`/ ${abbrev(props.cap)}`}
            </div>
          </Row>
        )}
      </Row>
      <Bar fraction={fill} tone={fillTone} height={16} />

      {props.resources.length > 0 ? (
        <Row style={{ flexWrap: "wrap", gap: GAP, marginTop: 16 }}>
          {props.resources.map((resource) => (
            <Resource resource={resource} cap={props.cap} />
          ))}
        </Row>
      ) : (
        <div style={{ display: "flex", marginTop: 16, fontSize: 24, color: color.muted }}>
          {props.labels.empty}
        </div>
      )}
    </CardFrame>
  );
}

export const baseCard: CardDef<BaseCardProps> = { id: "base", render: Base };
