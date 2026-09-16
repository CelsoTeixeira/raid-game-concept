import type { Attributes } from "./types";

export const BAG_COLUMNS = 5;
export const BAG_ROWS = 5;

export type InventoryPlacement = {
  x: number;
  y: number;
};

/** Additive bonuses applied when the item is equipped. Combat stats are not stored on the item. */
export type ItemBonuses = Partial<Attributes> & { armor?: number };

export type InventoryItem = InventoryPlacement & {
  id: string;
  name: string;
  width: number;
  height: number;
  bonuses: ItemBonuses;
};

/** Starter examples for the first group bag slice. Items keep their fixed orientation. */
export const STARTER_BAG: InventoryItem[] = [
  { id: "potion", name: "Potion", width: 1, height: 1, x: 0, y: 0, bonuses: {} },
  { id: "sword", name: "Sword", width: 1, height: 3, x: 1, y: 0, bonuses: { strength: 2 } },
  { id: "shield", name: "Shield", width: 2, height: 2, x: 3, y: 0, bonuses: { armor: 4 } },
  { id: "scroll", name: "Scroll", width: 1, height: 2, x: 0, y: 2, bonuses: {} },
  { id: "torch", name: "Torch", width: 2, height: 1, x: 2, y: 2, bonuses: {} },
  { id: "ring", name: "Ring", width: 1, height: 1, x: 4, y: 2, bonuses: { vitality: 1 } },
  { id: "herb", name: "Herb", width: 1, height: 1, x: 1, y: 3, bonuses: {} },
  { id: "rations", name: "Rations", width: 2, height: 1, x: 3, y: 3, bonuses: {} },
];

export function isInventoryPlacementValid(
  items: InventoryItem[],
  itemId: string,
  placement: InventoryPlacement,
): boolean {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item || !Number.isInteger(placement.x) || !Number.isInteger(placement.y)) return false;
  if (
    placement.x < 0 ||
    placement.y < 0 ||
    placement.x + item.width > BAG_COLUMNS ||
    placement.y + item.height > BAG_ROWS
  ) {
    return false;
  }

  return items.every((other) => {
    if (other.id === itemId) return true;
    return (
      placement.x + item.width <= other.x ||
      other.x + other.width <= placement.x ||
      placement.y + item.height <= other.y ||
      other.y + other.height <= placement.y
    );
  });
}

export function moveInventoryItem(
  items: InventoryItem[],
  itemId: string,
  placement: InventoryPlacement,
): InventoryItem[] {
  if (!isInventoryPlacementValid(items, itemId, placement)) return items;

  return items.map((item) => {
    if (item.id !== itemId) return item;
    if (item.x === placement.x && item.y === placement.y) return item;
    return { ...item, ...placement };
  });
}
