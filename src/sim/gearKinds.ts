import { MELEE_REACH } from "./balance";
import type { WeaponProfile } from "./stats";
import type { PrimaryStat } from "./types";

/** Where an item goes. `ring` fits either ring equipment slot. */
export const GEAR_SLOTS = ["mainHand", "offHand", "pants", "chest", "amulet", "ring"] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

export const GEAR_SLOT_LABELS: Record<GearSlot, string> = {
  mainHand: "Main hand",
  offHand: "Off hand",
  pants: "Pants",
  chest: "Chest",
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
  "pants",
  "chest",
  "amulet",
  "ring",
] as const;
export type GearKindId = (typeof GEAR_KIND_IDS)[number];

/**
 * Fixed traits of an item kind. `armor`, `threat` (percent), and `healing` are gray-rarity bases
 * that scale with rarity when rolled. `theme` null means a random primary stat per roll.
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
  pants: {
    label: "Pants",
    slot: "pants",
    nouns: ["Pants", "Greaves", "Leggings"],
    width: 2,
    height: 2,
    theme: "vitality",
    armor: 4,
  },
  chest: {
    label: "Chest",
    slot: "chest",
    nouns: ["Chest", "Vest", "Robe", "Mail"],
    width: 2,
    height: 2,
    theme: "vitality",
    armor: 6,
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
