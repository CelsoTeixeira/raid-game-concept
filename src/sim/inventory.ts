import type { EquipmentSlot } from "./character";
import type { Attributes } from "./types";

export const BAG_COLUMNS = 5;
export const BAG_ROWS = 5;

export const ITEM_RARITIES = ["gray", "green", "blue", "purple", "orange"] as const;
export type ItemRarity = (typeof ITEM_RARITIES)[number];

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
  rarity: ItemRarity;
  slot: EquipmentSlot;
};

export type UnplacedItem = Omit<InventoryItem, "x" | "y">;

export function isItemRarity(value: unknown): value is ItemRarity {
  return typeof value === "string" && (ITEM_RARITIES as readonly string[]).includes(value);
}

export function itemFitsAt(
  items: InventoryItem[],
  size: Pick<InventoryItem, "width" | "height">,
  placement: InventoryPlacement,
  ignoreId?: string,
): boolean {
  if (!Number.isInteger(placement.x) || !Number.isInteger(placement.y)) return false;
  if (
    placement.x < 0 ||
    placement.y < 0 ||
    placement.x + size.width > BAG_COLUMNS ||
    placement.y + size.height > BAG_ROWS
  ) {
    return false;
  }

  return items.every((other) => {
    if (other.id === ignoreId) return true;
    return (
      placement.x + size.width <= other.x ||
      other.x + other.width <= placement.x ||
      placement.y + size.height <= other.y ||
      other.y + other.height <= placement.y
    );
  });
}

export function isInventoryPlacementValid(
  items: InventoryItem[],
  itemId: string,
  placement: InventoryPlacement,
): boolean {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return false;
  return itemFitsAt(items, item, placement, item.id);
}

export function findInventoryPlacement(
  items: InventoryItem[],
  size: Pick<InventoryItem, "width" | "height">,
): InventoryPlacement | null {
  for (let y = 0; y <= BAG_ROWS - size.height; y += 1) {
    for (let x = 0; x <= BAG_COLUMNS - size.width; x += 1) {
      const placement = { x, y };
      if (itemFitsAt(items, size, placement)) return placement;
    }
  }
  return null;
}

export function addInventoryItem(items: InventoryItem[], item: UnplacedItem): InventoryItem[] | null {
  const placement = findInventoryPlacement(items, item);
  if (!placement) return null;
  return [...items, { ...item, ...placement }];
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
