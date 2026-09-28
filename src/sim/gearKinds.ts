import { MELEE_REACH } from "./balance";
import type { WeaponProfile } from "./stats";
import type { PrimaryStat } from "./types";

/** Where an item goes. `ring` fits either ring equipment slot. */
export const GEAR_SLOTS = ["mainHand", "offHand", "head", "chest", "pants", "amulet", "ring"] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

export const GEAR_SLOT_LABELS: Record<GearSlot, string> = {
  mainHand: "Main hand",
  offHand: "Off hand",
  head: "Head",
  chest: "Chest",
  pants: "Pants",
  amulet: "Amulet",
  ring: "Ring",
};

export const GEAR_KIND_IDS = [
  "sword",
  "axe",
  "mace",
  "dagger",
  "bow",
  "staff",
  "wand",
  "shield",
  "tome",
  "helmet",
  "chest",
  "pants",
  "amulet",
  "ring",
] as const;
export type GearKindId = (typeof GEAR_KIND_IDS)[number];

export const ARMOR_KIND_IDS = ["helmet", "chest", "pants"] as const;
export type ArmorKindId = (typeof ARMOR_KIND_IDS)[number];

export const ARMOR_FAMILIES = ["plate", "mail", "leather", "cloth"] as const;
export type ArmorFamily = (typeof ARMOR_FAMILIES)[number];

/**
 * Armor subfamily shared by helmet, chest, and pants: it sets the look, the main stat,
 * and a multiplier on the kind's armor base.
 */
export type ArmorFamilyDef = {
  label: string;
  theme: PrimaryStat;
  armorScale: number;
  nouns: Record<ArmorKindId, readonly string[]>;
};

export const ARMOR_FAMILY_DEFS: Record<ArmorFamily, ArmorFamilyDef> = {
  plate: {
    label: "Plate",
    theme: "strength",
    armorScale: 1.5,
    nouns: { helmet: ["Helm", "Greathelm"], chest: ["Cuirass", "Breastplate"], pants: ["Greaves", "Legplates"] },
  },
  mail: {
    label: "Mail",
    theme: "vitality",
    armorScale: 1.2,
    nouns: { helmet: ["Coif", "Mail Hood"], chest: ["Hauberk", "Mail Shirt"], pants: ["Chausses", "Mail Leggings"] },
  },
  leather: {
    label: "Leather",
    theme: "agility",
    armorScale: 0.9,
    nouns: { helmet: ["Cap", "Leather Cap"], chest: ["Jerkin", "Vest"], pants: ["Trousers", "Breeches"] },
  },
  cloth: {
    label: "Cloth",
    theme: "intelligence",
    armorScale: 0.5,
    nouns: { helmet: ["Hood", "Cowl"], chest: ["Robe", "Vestment"], pants: ["Leggings", "Wraps"] },
  },
};

export function isArmorKind(kind: GearKindId): kind is ArmorKindId {
  return (ARMOR_KIND_IDS as readonly string[]).includes(kind);
}

export function isArmorFamily(value: unknown): value is ArmorFamily {
  return typeof value === "string" && (ARMOR_FAMILIES as readonly string[]).includes(value);
}

/**
 * Fixed traits of an item kind. `armor`, `threat` (percent), and `healing` are gray-rarity bases
 * that scale with rarity when rolled. `theme` null means a random primary stat per roll.
 * Armor kinds take their nouns and theme from the rolled {@link ArmorFamily} instead.
 */
export type GearKind = {
  label: string;
  slot: GearSlot;
  nouns: readonly string[];
  width: number;
  height: number;
  theme: PrimaryStat | null;
  weapon?: WeaponProfile;
  armor?: number;
  threat?: number;
  healing?: number;
};

export const GEAR_KINDS: Record<GearKindId, GearKind> = {
  sword: {
    label: "Sword",
    slot: "mainHand",
    nouns: ["Sword", "Blade", "Saber"],
    width: 1,
    height: 3,
    theme: "strength",
    weapon: { scaling: "strength", damage: 4, speed: 1, range: MELEE_REACH, cleave: 0 },
  },
  axe: {
    label: "Axe",
    slot: "mainHand",
    nouns: ["Axe", "Hatchet", "Cleaver"],
    width: 1,
    height: 3,
    theme: "strength",
    weapon: { scaling: "strength", damage: 5, speed: 0.85, range: MELEE_REACH, cleave: 0.5 },
  },
  mace: {
    label: "Mace",
    slot: "mainHand",
    nouns: ["Mace", "Hammer", "Maul"],
    width: 1,
    height: 3,
    theme: "strength",
    weapon: { scaling: "strength", damage: 6, speed: 0.8, range: MELEE_REACH, cleave: 0 },
  },
  dagger: {
    label: "Dagger",
    slot: "mainHand",
    nouns: ["Dagger", "Dirk", "Knife"],
    width: 1,
    height: 2,
    theme: "agility",
    weapon: { scaling: "agility", damage: 2, speed: 1.2, range: MELEE_REACH, cleave: 0 },
  },
  bow: {
    label: "Bow",
    slot: "mainHand",
    nouns: ["Bow", "Longbow", "Shortbow"],
    width: 1,
    height: 3,
    theme: "agility",
    weapon: { scaling: "agility", damage: 4, speed: 0.9, range: 170, cleave: 0 },
  },
  staff: {
    label: "Staff",
    slot: "mainHand",
    nouns: ["Staff", "Stave", "Rod"],
    width: 1,
    height: 3,
    theme: "intelligence",
    weapon: { scaling: "intelligence", damage: 5, speed: 0.8, range: 150, cleave: 0 },
  },
  wand: {
    label: "Wand",
    slot: "mainHand",
    nouns: ["Wand", "Scepter", "Sprig"],
    width: 1,
    height: 2,
    theme: "intelligence",
    weapon: { scaling: "intelligence", damage: 2, speed: 1, range: 140, cleave: 0 },
    healing: 6,
  },
  shield: {
    label: "Shield",
    slot: "offHand",
    nouns: ["Shield", "Buckler", "Aegis"],
    width: 2,
    height: 2,
    theme: "vitality",
    armor: 5,
    threat: 50,
  },
  tome: {
    label: "Tome",
    slot: "offHand",
    nouns: ["Tome", "Codex", "Psalter"],
    width: 1,
    height: 2,
    theme: "intelligence",
    healing: 5,
  },
  helmet: {
    label: "Helmet",
    slot: "head",
    nouns: [],
    width: 2,
    height: 2,
    theme: null,
    armor: 3,
  },
  chest: {
    label: "Chest",
    slot: "chest",
    nouns: [],
    width: 2,
    height: 2,
    theme: null,
    armor: 6,
  },
  pants: {
    label: "Pants",
    slot: "pants",
    nouns: [],
    width: 2,
    height: 2,
    theme: null,
    armor: 4,
  },
  amulet: {
    label: "Amulet",
    slot: "amulet",
    nouns: ["Amulet", "Necklace", "Pendant"],
    width: 1,
    height: 1,
    theme: "intelligence",
  },
  ring: {
    label: "Ring",
    slot: "ring",
    nouns: ["Ring", "Band", "Signet"],
    width: 1,
    height: 1,
    theme: null,
  },
};

export function isGearKindId(value: unknown): value is GearKindId {
  return typeof value === "string" && (GEAR_KIND_IDS as readonly string[]).includes(value);
}

export function gearKindsForSlot(slot: GearSlot): GearKindId[] {
  return GEAR_KIND_IDS.filter((id) => GEAR_KINDS[id].slot === slot);
}
