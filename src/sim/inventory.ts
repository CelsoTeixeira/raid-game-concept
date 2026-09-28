import { GEAR_KINDS, isGearKindId, type GearKindId, type GearSlot } from "./gearKinds";
import type { Attributes } from "./types";

/** Guild storage grid. */
export const BAG_COLUMNS = 10;
export const BAG_ROWS = 10;

const BONUS_KEYS = ["vitality", "intelligence", "strength", "agility", "armor", "threat", "healing"] as const;

export const ITEM_RARITIES = ["gray", "green", "blue", "purple", "orange"] as const;
export type ItemRarity = (typeof ITEM_RARITIES)[number];

export const RARITY_LABELS: Record<ItemRarity, string> = {
  gray: "Gray",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  orange: "Orange",
};

export type InventoryPlacement = {
  x: number;
  y: number;
};

/**
 * Additive bonuses applied when the item is equipped. `threat` is percent.
 * Weapon traits (damage, speed, range, cleave) come from the item kind, not bonuses.
 */
export type ItemBonuses = Partial<Attributes> & { armor?: number; threat?: number; healing?: number };

export type InventoryItem = InventoryPlacement & {
  id: string;
  name: string;
  width: number;
  height: number;
  bonuses: ItemBonuses;
  rarity: ItemRarity;
  kind: GearKindId;
  slot: GearSlot;
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

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Validates stored gear, from the bag or an equipment slot. The slot must match the kind. */
export function parseGearItem(value: unknown): UnplacedItem | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  if (!isPositiveInteger(raw.width) || !isPositiveInteger(raw.height)) return null;
  if (!isItemRarity(raw.rarity) || !isGearKindId(raw.kind)) return null;
  if (raw.slot !== GEAR_KINDS[raw.kind].slot) return null;
  if (typeof raw.bonuses !== "object" || raw.bonuses === null) return null;

  const rawBonuses = raw.bonuses as Record<string, unknown>;
  const bonuses: ItemBonuses = {};
  for (const key of BONUS_KEYS) {
    const bonus = rawBonuses[key];
    if (typeof bonus === "number" && Number.isFinite(bonus)) bonuses[key] = bonus;
  }

  return {
    id: raw.id,
    name: raw.name,
    width: raw.width,
    height: raw.height,
    bonuses,
    rarity: raw.rarity,
    kind: raw.kind,
    slot: GEAR_KINDS[raw.kind].slot,
  };
}

/**
 * Stored grid items. Invalid, overlapping, or duplicate entries are dropped one by one;
 * `seen` holds ids that already live elsewhere (equipped gear) and collects the kept ones.
 */
export function parseInventory(value: unknown, seen: Set<string>): InventoryItem[] {
  if (!Array.isArray(value)) return [];
  let items: InventoryItem[] = [];
  for (const raw of value) {
    const item = parseGearItem(raw);
    if (!item || seen.has(item.id)) continue;
    const { x, y } = raw as { x?: unknown; y?: unknown };
    if (typeof x !== "number" || typeof y !== "number") continue;
    if (!itemFitsAt(items, item, { x, y })) continue;
    seen.add(item.id);
    items = [...items, { ...item, x, y }];
  }
  return items;
}
