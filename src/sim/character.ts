import { combatStatsFrom } from "./balance";
import {
  getSpec,
  memberRangeType,
  memberRole,
  memberWithClass,
  memberWithSpec,
  type ClassKit,
  type UnitClass,
} from "./classes";
import type { ItemBonuses } from "./inventory";
import type { Attributes, RangeType, Role, Stats } from "./types";

export const EQUIPMENT_SLOTS = [
  "mainHand",
  "offHand",
  "pants",
  "chest",
  "amulet",
  "ring1",
  "ring2",
] as const;

export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  mainHand: "Main hand",
  offHand: "Off hand",
  pants: "Pants",
  chest: "Chest",
  amulet: "Amulet",
  ring1: "Ring 1",
  ring2: "Ring 2",
};

export type EquippedItem = {
  id: string;
  name: string;
  bonuses: ItemBonuses;
};

export type Equipment = Record<EquipmentSlot, EquippedItem | null>;

/**
 * Roster character. `attributes` and `stats` are a cache.
 * Call {@link refreshCombat} only when class, spec, or gear changes — gameplay reads the cache.
 */
export type Character = ClassKit & {
  id: string;
  equipment: Equipment;
  attributes: Attributes;
  stats: Stats;
  role: Role;
  rangeType: RangeType;
};

export function emptyEquipment(): Equipment {
  return {
    mainHand: null,
    offHand: null,
    pants: null,
    chest: null,
    amulet: null,
    ring1: null,
    ring2: null,
  };
}

function addBonuses(base: Attributes, bonuses: ItemBonuses): Attributes {
  return {
    vitality: base.vitality + (bonuses.vitality ?? 0),
    intelligence: base.intelligence + (bonuses.intelligence ?? 0),
    strength: base.strength + (bonuses.strength ?? 0),
    agility: base.agility + (bonuses.agility ?? 0),
  };
}

function gearTotals(equipment: Equipment): { attributes: Attributes; armor: number } {
  let attributes: Attributes = { vitality: 0, intelligence: 0, strength: 0, agility: 0 };
  let armor = 0;
  for (const slot of EQUIPMENT_SLOTS) {
    const item = equipment[slot];
    if (!item) continue;
    attributes = addBonuses(attributes, item.bonuses);
    armor += item.bonuses.armor ?? 0;
  }
  return { attributes, armor };
}

export type CharacterDraft = ClassKit & {
  id: string;
  equipment: Equipment;
};

/** Rebuild cached combat numbers. Only call from organizer-style gear/class/spec edits. */
export function refreshCombat(draft: CharacterDraft): Character {
  const spec = getSpec(draft);
  const gear = gearTotals(draft.equipment);
  const attributes = addBonuses(spec.attributes, gear.attributes);
  const stats = combatStatsFrom(spec, attributes);
  stats.armor += gear.armor;
  return {
    ...draft,
    attributes,
    stats,
    role: memberRole(draft),
    rangeType: spec.role === "tank" ? "melee" : memberRangeType(draft),
  };
}

export function createCharacter(kit: ClassKit, id: string): Character {
  return refreshCombat({ ...kit, id, equipment: emptyEquipment() });
}

export function characterWithClass(character: Character, unitClass: UnitClass): Character {
  return refreshCombat({ ...character, ...memberWithClass(unitClass) });
}

export function characterWithSpec(character: Character, subclass: string): Character {
  return refreshCombat({
    ...character,
    ...memberWithSpec(character.unitClass, subclass),
  });
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

export function copyCombatStats(stats: Stats): Stats {
  return { ...stats };
}
