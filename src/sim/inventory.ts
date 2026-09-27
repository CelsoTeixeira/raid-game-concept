import { EQUIPMENT_SLOTS, type EquipmentSlot } from "./character";
import type { Attributes } from "./types";

export const BAG_COLUMNS = 5;
export const BAG_ROWS = 5;

const BAG_STORAGE_KEY = "raid-game.bag.v1";
const BONUS_KEYS = ["vitality", "intelligence", "strength", "agility", "armor"] as const;

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

function isEquipmentSlot(value: unknown): value is EquipmentSlot {
  return typeof value === "string" && (EQUIPMENT_SLOTS as readonly string[]).includes(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Validates stored gear, from the bag or an equipment slot. */
export function parseGearItem(value: unknown): UnplacedItem | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  if (!isPositiveInteger(raw.width) || !isPositiveInteger(raw.height)) return null;
  if (!isItemRarity(raw.rarity) || !isEquipmentSlot(raw.slot)) return null;
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
    slot: raw.slot,
  };
}

/** Saved bag, or null when nothing valid is stored. */
export function loadPersistedBag(): InventoryItem[] | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(BAG_STORAGE_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return null;

    let bag: InventoryItem[] = [];
    for (const raw of parsed) {
      const item = parseGearItem(raw);
      if (!item) return null;
      const { x, y } = raw as { x?: unknown; y?: unknown };
      if (typeof x !== "number" || typeof y !== "number") return null;
      if (!itemFitsAt(bag, item, { x, y })) return null;
      bag = [...bag, { ...item, x, y }];
    }
    return bag;
  } catch {
    return null;
  }
}

export function persistBag(items: InventoryItem[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(BAG_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage can be unavailable or full; the in-memory bag remains usable.
  }
}
