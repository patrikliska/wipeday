/**
 * The inventory card: a Rust-style grid of everything owned that is not a raw
 * resource. Icon, count badge, name, rarity-coloured frame.
 */
import { abbrev } from "../../ui/format";
import { color, layout, type Tier, tierColor, withAlpha } from "../../ui/theme";
import { CardFrame, Col, Divider, Fit, Icon, Label, Row } from "../components";
import { type CardDef, useRender } from "../renderer";

export interface InventoryCardProps {
  /** Owned items in display order. */
  items: Array<{ id: string; count: number; tier: Tier }>;
  workbenchLevel: number;
  boxesUsed: number;
  boxSlots: number;
}

const COLUMNS = 3;
const GAP = 10;
const CELL_WIDTH = (layout.cardWidth - layout.pad * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
const CELL_HEIGHT = 76;

function ItemCell({ id, count, tier }: { id: string; count: number; tier: Tier }) {
  const { locale } = useRender();
  const tint = tierColor[tier];
  return (
    <Row
      style={{
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
        padding: "0 10px",
        alignItems: "center",
        borderRadius: 12,
        backgroundColor: color.panel,
        border: `2px solid ${withAlpha(tint, 0.45)}`,
      }}
    >
      <Icon folder="icons_256" name={id} size={44} tier={tier} />
      <Col style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
        <Fit
          style={{ fontSize: 28, fontWeight: 700, lineHeight: "32px" }}
        >{`×${abbrev(count)}`}</Fit>
        <Fit style={{ color: color.muted, lineHeight: "26px" }}>{locale.t(`item.${id}.name`)}</Fit>
      </Col>
    </Row>
  );
}

function Inventory(props: InventoryCardProps) {
  const { locale } = useRender();
  const count = props.items.reduce((sum, item) => sum + item.count, 0);
  return (
    <CardFrame>
      <Row style={{ alignItems: "baseline", justifyContent: "space-between" }}>
        <Col>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, lineHeight: "46px" }}>
            {locale.t("card.inventory.title")}
          </div>
          <Fit style={{ fontSize: 24, color: color.muted }}>
            {count === 0
              ? locale.t("card.inventory.subtitle_none")
              : locale.t("card.inventory.subtitle", {
                  count: abbrev(count),
                  level: props.workbenchLevel,
                })}
          </Fit>
        </Col>
        <Label>
          {locale.t("card.inventory.boxes", { used: props.boxesUsed, slots: props.boxSlots })}
        </Label>
      </Row>

      <Col style={{ marginTop: 18, marginBottom: 18 }}>
        <Divider />
      </Col>

      {props.items.length === 0 ? (
        <Row
          style={{
            height: 100,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            border: `2px dashed ${color.border}`,
            color: color.muted,
            fontSize: 24,
          }}
        >
          {locale.t("card.inventory.empty")}
        </Row>
      ) : (
        <Row style={{ flexWrap: "wrap", gap: GAP }}>
          {props.items.map((item) => (
            <ItemCell id={item.id} count={item.count} tier={item.tier} />
          ))}
        </Row>
      )}
    </CardFrame>
  );
}

export const inventoryCard: CardDef<InventoryCardProps> = { id: "inventory", render: Inventory };
