import type { EquipmentSlot } from "./character";
import { PRIMARY_STATS, STAT_LABELS } from "./classes";
import {
  addInventoryItem,
  ITEM_RARITIES,
  type InventoryItem,
  type ItemBonuses,
  type ItemRarity,
  type UnplacedItem,
} from "./inventory";
import type { PrimaryStat } from "./types";

export type Rng = {
  next(): number;
};

type GearKind = {
  slot: EquipmentSlot;
  nouns: readonly string[];
  width: number;
  height: number;
  theme: PrimaryStat;
};

const GEAR_KINDS: readonly GearKind[] = [
  { slot: "mainHand", nouns: ["Sword", "Axe", "Mace"], width: 1, height: 3, theme: "strength" },
  { slot: "mainHand", nouns: ["Dagger"], width: 1, height: 2, theme: "agility" },
  { slot: "mainHand", nouns: ["Staff"], width: 1, height: 3, theme: "intelligence" },
  { slot: "offHand", nouns: ["Shield", "Buckler"], width: 2, height: 2, theme: "vitality" },
  { slot: "offHand", nouns: ["Tome"], width: 1, height: 2, theme: "intelligence" },
  { slot: "pants", nouns: ["Pants", "Greaves", "Leggings"], width: 2, height: 2, theme: "vitality" },
  { slot: "chest", nouns: ["Chest", "Vest", "Robe", "Mail"], width: 2, height: 2, theme: "vitality" },
  { slot: "amulet", nouns: ["Amulet", "Necklace", "Pendant"], width: 1, height: 1, theme: "intelligence" },
  { slot: "ring1", nouns: ["Ring", "Band", "Signet"], width: 1, height: 1, theme: "agility" },
];

export const RARITY_ADJECTIVES: Record<ItemRarity, readonly string[]> = {
  gray: ["Worn", "Rusty", "Cracked", "Bent", "Faded"],
  green: ["Sturdy", "Fine", "Keen", "Polished", "Solid"],
  blue: ["Runed", "Gleaming", "Knight's", "Tempered", "Blessed"],
  purple: ["Ancient", "Champion's", "Royal", "Vengeful", "Mythic"],
  orange: ["Eternal", "Godforged", "Dawnforged", "Empyrean", "Worldforged"],
};

/** Total primary-stat points rolled onto an item of this rarity. */
export const RARITY_BUDGET: Record<ItemRarity, number> = {
  gray: 1,
  green: 3,
  blue: 6,
  purple: 11,
  orange: 18,
};

export const RARITY_STAT_COUNT: Record<ItemRarity, number> = {
  gray: 1,
  green: 2,
  blue: 2,
  purple: 3,
  orange: 4,
};

export const RARITY_WEIGHTS: Record<ItemRarity, number> = {
  gray: 0.4,
  green: 0.3,
  blue: 0.18,
  purple: 0.09,
  orange: 0.03,
};

export const GEAR_SLOTS = ["mainHand", "offHand", "pants", "chest", "amulet", "ring1"] as const;

const STAT_ABBREV: Record<PrimaryStat, string> = {
  vitality: "Vit",
  intelligence: "Int",
  strength: "Str",
  agility: "Agi",
};

const STARTER_PLANS: readonly { rarity: ItemRarity; slot: EquipmentSlot }[] = [
  { rarity: "gray", slot: "mainHand" },
  { rarity: "green", slot: "chest" },
  { rarity: "blue", slot: "ring1" },
  { rarity: "purple", slot: "offHand" },
  { rarity: "orange", slot: "amulet" },
];

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

function pickOne<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng.next() * items.length)]!;
}

function pickRarity(rng: Rng): ItemRarity {
  const roll = rng.next();
  let acc = 0;
  for (const rarity of ITEM_RARITIES) {
    acc += RARITY_WEIGHTS[rarity];
    if (roll < acc) return rarity;
  }
  return "orange";
}

function kindsForSlot(slot: EquipmentSlot): readonly GearKind[] {
  const kinds = GEAR_KINDS.filter((kind) => kind.slot === slot);
  return kinds.length > 0 ? kinds : GEAR_KINDS;
}

function distributeBonuses(
  budget: number,
  theme: PrimaryStat,
  statCount: number,
  rng: Rng,
): ItemBonuses {
  const extras = PRIMARY_STATS.filter((stat) => stat !== theme);
  const shuffled = [...extras];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng.next() * (index + 1));
    const current = shuffled[index]!;
    shuffled[index] = shuffled[swap]!;
    shuffled[swap] = current;
  }

  const stats: PrimaryStat[] = [theme, ...shuffled.slice(0, Math.max(0, statCount - 1))];
  const bonuses: ItemBonuses = {};
  let remaining = budget;

  for (const stat of stats) {
    if (remaining <= 0) break;
    bonuses[stat] = 1;
    remaining -= 1;
  }

  while (remaining > 0) {
    const stat = rng.next() < 0.55 ? theme : pickOne(rng, stats);
    bonuses[stat] = (bonuses[stat] ?? 0) + 1;
    remaining -= 1;
  }

  return bonuses;
}

export function primaryBonusTotal(bonuses: ItemBonuses): number {
  return PRIMARY_STATS.reduce((sum, stat) => sum + (bonuses[stat] ?? 0), 0);
}

export function formatItemBonuses(bonuses: ItemBonuses): string {
  return PRIMARY_STATS.filter((stat) => (bonuses[stat] ?? 0) > 0)
    .map((stat) => `+${bonuses[stat]} ${STAT_LABELS[stat]}`)
    .join(" · ");
}

export function formatItemBonusesShort(bonuses: ItemBonuses): string {
  return PRIMARY_STATS.filter((stat) => (bonuses[stat] ?? 0) > 0)
    .map((stat) => `+${bonuses[stat]} ${STAT_ABBREV[stat]}`)
    .join(" ");
}

export function generateGear(options: {
  rng: Rng;
  id?: string;
  rarity?: ItemRarity;
  slot?: EquipmentSlot;
}): UnplacedItem {
  const rarity = options.rarity ?? pickRarity(options.rng);
  const kind = pickOne(options.rng, options.slot ? kindsForSlot(options.slot) : GEAR_KINDS);
  const noun = pickOne(options.rng, kind.nouns);
  const adjective = pickOne(options.rng, RARITY_ADJECTIVES[rarity]);
  const theme = kind.slot === "ring1" ? pickOne(options.rng, PRIMARY_STATS) : kind.theme;

  return {
    id: options.id ?? `gear-${Math.floor(options.rng.next() * 1e9).toString(36)}`,
    name: `${adjective} ${noun}`,
    width: kind.width,
    height: kind.height,
    bonuses: distributeBonuses(RARITY_BUDGET[rarity], theme, RARITY_STAT_COUNT[rarity], options.rng),
    rarity,
    slot: kind.slot,
  };
}

/** One item per rarity so the bag sketch shows the full color ladder. */
export function generateStarterBag(seed = 1): InventoryItem[] {
  const rng = mulberry32(seed);
  let bag: InventoryItem[] = [];

  STARTER_PLANS.forEach((plan, index) => {
    const item = generateGear({
      rng,
      id: `gear-starter-${index}`,
      rarity: plan.rarity,
      slot: plan.slot,
    });
    const packed = addInventoryItem(bag, item);
    if (!packed) {
      throw new Error(`Starter bag could not place ${item.name}`);
    }
    bag = packed;
  });

  return bag;
}

export function rollItemIntoBag(items: InventoryItem[], seed = Date.now()): InventoryItem[] {
  const rng = mulberry32(seed >>> 0);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const packed = addInventoryItem(items, generateGear({ rng }));
    if (packed) return packed;
  }
  return items;
}
