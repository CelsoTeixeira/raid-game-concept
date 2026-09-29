import { itemIconUrl } from "../art";
import type { InventoryItem } from "../sim/inventory";

type IconItem = Pick<InventoryItem, "kind" | "armorFamily" | "width" | "height" | "rarity">;

/** The item's icon in a bag-sized slot; rarity shows only as the border (D3). */
export function ItemIcon({ item, cell, scale }: { item: IconItem; cell: number; scale: number }) {
  return (
    <span className="item-icon" data-rarity={item.rarity} style={{ width: item.width * cell, height: item.height * cell }}>
      <img src={itemIconUrl(item.kind, item.armorFamily)} alt="" style={{ transform: `scale(${scale})` }} />
    </span>
  );
}
