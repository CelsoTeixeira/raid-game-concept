import type { ArtLook } from "../art";
import { GEAR_KINDS, type GearSlot } from "./gearKinds";
import type { UnplacedItem } from "./inventory";
import type { Sex } from "./names";
import { addAttributes, deriveStats, UNARMED, type GearTotals } from "./stats";
import type { Attributes, Role, Stats } from "./types";

export const EQUIPMENT_SLOTS = [
  "mainHand",
  "offHand",
  "head",
  "chest",
  "pants",
  "amulet",
  "ring1",
  "ring2",
] as const;

export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  mainHand: "Main hand",
  offHand: "Off hand",
  head: "Head",
  chest: "Chest",
  pants: "Pants",
  amulet: "Amulet",
  ring1: "Ring 1",
  ring2: "Ring 2",
};

export const ROLES: readonly Role[] = ["tank", "dps", "healer"];

export const ROLE_LABELS: Record<Role, string> = {
  tank: "Tank",
  dps: "DPS",
  healer: "Healer",
};

export const ROLE_HELPS: Record<Role, string> = {
  tank: "Goes after enemies attacking allies.",
  dps: "Attacks the nearest enemy.",
  healer: "Heals hurt allies, attacks when nobody needs it.",
};

/** Equipped gear keeps its bag footprint and slot so it can go back into the bag. */
export type EquippedItem = UnplacedItem;

export type Equipment = Record<EquipmentSlot, EquippedItem | null>;

/** Equipment slots an item can go in. Rings fit either ring slot. */
export function slotsForItem(itemSlot: GearSlot): EquipmentSlot[] {
  return itemSlot === "ring" ? ["ring1", "ring2"] : [itemSlot];
}

/** Source of truth that gets saved. Stats come from here. */
export type CharacterDraft = {
  id: string;
  baseAttributes: Attributes;
  equipment: Equipment;
  role: Role;
  sex: Sex;
  look: ArtLook;
};

/**
 * Roster character. `attributes` (base + gear) and `stats` are a cache.
 * Call {@link refreshCombat} when base attributes or gear change — gameplay reads the cache.
 */
export type Character = CharacterDraft & {
  attributes: Attributes;
  stats: Stats;
};

export function emptyEquipment(): Equipment {
  return {
    mainHand: null,
    offHand: null,
    head: null,
    chest: null,
    pants: null,
    amulet: null,
    ring1: null,
    ring2: null,
  };
}

function gearTotals(equipment: Equipment): { attributes: Partial<Attributes>; totals: GearTotals } {
  let attributes: Attributes = { vitality: 0, intelligence: 0, strength: 0, agility: 0 };
  const totals: GearTotals = { armor: 0, threat: 0, healing: 0 };
  for (const slot of EQUIPMENT_SLOTS) {
    const item = equipment[slot];
    if (!item) continue;
    attributes = addAttributes(attributes, item.bonuses);
    totals.armor += item.bonuses.armor ?? 0;
    totals.threat += item.bonuses.threat ?? 0;
    totals.healing += item.bonuses.healing ?? 0;
  }
  return { attributes, totals };
}

function weaponOf(equipment: Equipment) {
  const mainHand = equipment.mainHand;
  return (mainHand && GEAR_KINDS[mainHand.kind].weapon) || UNARMED;
}

/** Rebuild cached attributes and combat numbers from base attributes and gear. */
export function refreshCombat(draft: CharacterDraft): Character {
  const gear = gearTotals(draft.equipment);
  const attributes = addAttributes(draft.baseAttributes, gear.attributes);
  return {
    ...draft,
    attributes,
    stats: deriveStats(attributes, weaponOf(draft.equipment), gear.totals),
  };
}

export function createCharacter(draft: Omit<CharacterDraft, "equipment"> & { equipment?: Equipment }): Character {
  return refreshCombat({ ...draft, equipment: draft.equipment ?? emptyEquipment() });
}

export function characterWithRole(character: Character, role: Role): Character {
  return { ...character, role };
}

export function characterWithBaseAttributes(character: Character, baseAttributes: Attributes): Character {
  return refreshCombat({ ...character, baseAttributes });
}

export function characterWithEquipment(
  character: Character,
  slot: EquipmentSlot,
  item: EquippedItem | null,
): Character {
  return refreshCombat({
    ...character,
    equipment: { ...character.equipment, [slot]: item },
  });
}

export function equippedItemIds(characters: readonly Character[]): Set<string> {
  const ids = new Set<string>();
  for (const character of characters) {
    for (const slot of EQUIPMENT_SLOTS) {
      const item = character.equipment[slot];
      if (item) ids.add(item.id);
    }
  }
  return ids;
}

export function copyCombatStats(stats: Stats): Stats {
  return { ...stats };
}
