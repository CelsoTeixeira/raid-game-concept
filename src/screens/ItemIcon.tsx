import { itemIconUrl } from "../art";
import type { InventoryItem } from "../sim/inventory";

type IconItem = Pick<InventoryItem, "kind" | "armorFamily" | "width" | "height" | "rarity">;

/** The bare icon at a whole-pixel `scale`; it does not take pointer events, so drags start on its container. */
export function ItemIconImage({ item, scale }: { item: Pick<IconItem, "kind" | "armorFamily">; scale: number }) {
  return (
    <img
      className="item-icon-image"
      src={itemIconUrl(item.kind, item.armorFamily)}
      alt=""
      draggable={false}
      style={{ transform: `scale(${scale})` }}
    />
  );
}

/** The item's icon in a bag-sized slot; rarity shows only as the border (D3). */
export function ItemIcon({ item, cell, scale }: { item: IconItem; cell: number; scale: number }) {
  return (
    <span className="item-icon" data-rarity={item.rarity} style={{ width: item.width * cell, height: item.height * cell }}>
      <ItemIconImage item={item} scale={scale} />
    </span>
  );
}
