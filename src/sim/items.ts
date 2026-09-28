import {
  ARMOR_FAMILIES,
  ARMOR_FAMILY_DEFS,
  GEAR_KINDS,
  GEAR_SLOTS,
  gearKindsForSlot,
  isArmorKind,
  type ArmorFamily,
  type GearKindId,
  type GearSlot,
} from "./gearKinds";
import {
  addInventoryItem,
  ITEM_RARITIES,
  type InventoryItem,
  type ItemBonuses,
  type ItemRarity,
  type UnplacedItem,
} from "./inventory";
import { isRanged, PRIMARY_STATS, STAT_LABELS } from "./stats";
import type { PrimaryStat } from "./types";

export type Rng = {
  next(): number;
};

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

/** Multiplier on a kind's armor, threat, and healing base. */
export const RARITY_TRAIT_SCALE: Record<ItemRarity, number> = {
  gray: 1,
  green: 1.5,
  blue: 2.2,
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

const STAT_ABBREV: Record<PrimaryStat, string> = {
  vitality: "Vit",
  intelligence: "Int",
  strength: "Str",
  agility: "Agi",
};

const STARTER_PLANS: readonly { rarity: ItemRarity; slot: GearSlot }[] = [
  { rarity: "gray", slot: "mainHand" },
  { rarity: "green", slot: "chest" },
  { rarity: "blue", slot: "ring" },
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

/** Unique across sessions; rolled items must never share an id. */
export function newItemId(): string {
  const uuid =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `gear-${uuid}`;
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

function traitBonuses(kind: GearKindId, rarity: ItemRarity, family: ArmorFamily | undefined): ItemBonuses {
  const def = GEAR_KINDS[kind];
  const scale = RARITY_TRAIT_SCALE[rarity];
  const armorScale = family ? ARMOR_FAMILY_DEFS[family].armorScale : 1;
  const bonuses: ItemBonuses = {};
  if (def.armor) bonuses.armor = Math.round(def.armor * scale * armorScale);
  if (def.threat) bonuses.threat = Math.round(def.threat * scale);
  if (def.healing) bonuses.healing = Math.round(def.healing * scale);
  return bonuses;
}

/** "Plate Chest" for armor, the plain kind label otherwise. */
export function itemKindLabel(item: Pick<InventoryItem, "kind" | "armorFamily">): string {
  const label = GEAR_KINDS[item.kind].label;
  return item.armorFamily ? `${ARMOR_FAMILY_DEFS[item.armorFamily].label} ${label}` : label;
}

export function primaryBonusTotal(bonuses: ItemBonuses): number {
  return PRIMARY_STATS.reduce((sum, stat) => sum + (bonuses[stat] ?? 0), 0);
}

function traitParts(bonuses: ItemBonuses, short: boolean): string[] {
  const parts: string[] = [];
  if (bonuses.armor) parts.push(`+${bonuses.armor} ${short ? "Arm" : "Armor"}`);
  if (bonuses.threat) parts.push(`+${bonuses.threat}% ${short ? "Thr" : "Threat"}`);
  if (bonuses.healing) parts.push(`+${bonuses.healing} ${short ? "Heal" : "Healing"}`);
  return parts;
}

export function formatItemBonuses(bonuses: ItemBonuses): string {
  return [
    ...PRIMARY_STATS.filter((stat) => (bonuses[stat] ?? 0) > 0).map(
      (stat) => `+${bonuses[stat]} ${STAT_LABELS[stat]}`,
    ),
    ...traitParts(bonuses, false),
  ].join(" · ");
}

export function formatItemBonusesShort(bonuses: ItemBonuses): string {
  return [
    ...PRIMARY_STATS.filter((stat) => (bonuses[stat] ?? 0) > 0).map(
      (stat) => `+${bonuses[stat]} ${STAT_ABBREV[stat]}`,
    ),
    ...traitParts(bonuses, true),
  ].join(" ");
}

/** Weapon line for a kind, e.g. "Str · 5 dmg · 0.85/s · melee · cleave 50%". Empty for non-weapons. */
export function formatWeapon(kind: GearKindId): string {
  const weapon = GEAR_KINDS[kind].weapon;
  if (!weapon) return "";
  const parts = [
    STAT_ABBREV[weapon.scaling],
    `${weapon.damage} dmg`,
    `${weapon.speed}/s`,
    isRanged({ attackRange: weapon.range }) ? `range ${weapon.range}` : "melee",
  ];
  if (weapon.cleave > 0) parts.push(`cleave ${Math.round(weapon.cleave * 100)}%`);
  return parts.join(" · ");
}

export function generateGear(options: {
  rng: Rng;
  id?: string;
  rarity?: ItemRarity;
  slot?: GearSlot;
  kind?: GearKindId;
  armorFamily?: ArmorFamily;
}): UnplacedItem {
  const { rng } = options;
  const rarity = options.rarity ?? pickRarity(rng);
  const kind = options.kind ?? pickOne(rng, gearKindsForSlot(options.slot ?? pickOne(rng, GEAR_SLOTS)));
  const def = GEAR_KINDS[kind];
  const family = isArmorKind(kind) ? (options.armorFamily ?? pickOne(rng, ARMOR_FAMILIES)) : undefined;
  const noun = pickOne(rng, family && isArmorKind(kind) ? ARMOR_FAMILY_DEFS[family].nouns[kind] : def.nouns);
  const adjective = pickOne(rng, RARITY_ADJECTIVES[rarity]);
  const theme = (family && ARMOR_FAMILY_DEFS[family].theme) ?? def.theme ?? pickOne(rng, PRIMARY_STATS);

  return {
    id: options.id ?? `gear-${Math.floor(rng.next() * 1e9).toString(36)}`,
    name: `${adjective} ${noun}`,
    width: def.width,
    height: def.height,
    bonuses: {
      ...distributeBonuses(RARITY_BUDGET[rarity], theme, RARITY_STAT_COUNT[rarity], rng),
      ...traitBonuses(kind, rarity, family),
    },
    rarity,
    kind,
    slot: def.slot,
    ...(family && { armorFamily: family }),
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
    const packed = addInventoryItem(items, generateGear({ rng, id: newItemId() }));
    if (packed) return packed;
  }
  return items;
}
