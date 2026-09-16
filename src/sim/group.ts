import {
  createCharacter,
  emptyEquipment,
  refreshCombat,
  type Character,
  type CharacterDraft,
  type EquippedItem,
  type Equipment,
  type EquipmentSlot,
  EQUIPMENT_SLOTS,
} from "./character";
import { CLASS_SPECS, isUnitClass, type ClassKit, type UnitClass } from "./classes";
import { isItemRarity } from "./inventory";
import type { RangeType, Role } from "./types";

export type { Character } from "./character";
export type GroupMember = Character;

/** Default group for 5-man content. Combat stats are filled by {@link createCharacter}. */
export const DEFAULT_GROUP: Character[] = [
  createCharacter({ unitClass: "paladin", subclass: "protection" }, "char-1"),
  createCharacter({ unitClass: "warrior", subclass: "arms" }, "char-2"),
  createCharacter({ unitClass: "rogue", subclass: "assassination" }, "char-3"),
  createCharacter({ unitClass: "mage", subclass: "fire" }, "char-4"),
  createCharacter({ unitClass: "priest", subclass: "holy" }, "char-5"),
];

const GROUP_STORAGE_KEY = "raid-game.group.v3";

function isClassKit(value: unknown): value is ClassKit {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const member = value as { unitClass?: unknown; subclass?: unknown };
  if (!isUnitClass(member.unitClass) || typeof member.subclass !== "string") return false;
  return member.subclass in CLASS_SPECS[member.unitClass];
}

function isEquippedItem(value: unknown): value is EquippedItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as { id?: unknown; name?: unknown; bonuses?: unknown };
  return typeof item.id === "string" && typeof item.name === "string" && typeof item.bonuses === "object" && item.bonuses !== null;
}

function parseEquipment(value: unknown): Equipment {
  const equipment = emptyEquipment();
  if (typeof value !== "object" || value === null || Array.isArray(value)) return equipment;
  const raw = value as Partial<Record<EquipmentSlot, unknown>>;
  for (const slot of EQUIPMENT_SLOTS) {
    const item = raw[slot];
    if (item === null) equipment[slot] = null;
    else if (isEquippedItem(item)) {
      equipment[slot] = {
        id: item.id,
        name: item.name,
        bonuses: { ...item.bonuses },
        ...(isItemRarity(item.rarity) ? { rarity: item.rarity } : {}),
      };
    }
  }
  return equipment;
}

function isLegacyMember(value: unknown): value is { role: Role; rangeType: RangeType } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const member = value as { role?: unknown; rangeType?: unknown };
  return (
    (member.role === "tank" || member.role === "healer" || member.role === "dps") &&
    (member.rangeType === "melee" || member.rangeType === "ranged")
  );
}

function fromLegacy(member: { role: Role; rangeType: RangeType }, index: number): Character {
  if (member.role === "tank") return createCharacter({ unitClass: "paladin", subclass: "protection" }, `char-${index + 1}`);
  if (member.role === "healer") {
    return member.rangeType === "melee"
      ? createCharacter({ unitClass: "paladin", subclass: "holy" }, `char-${index + 1}`)
      : createCharacter({ unitClass: "priest", subclass: "holy" }, `char-${index + 1}`);
  }
  if (member.rangeType === "ranged") return createCharacter({ unitClass: "mage", subclass: "fire" }, `char-${index + 1}`);
  return createCharacter({ unitClass: "warrior", subclass: "arms" }, `char-${index + 1}`);
}

function parseMember(value: unknown, index: number): Character | null {
  if (!isClassKit(value) && !isLegacyMember(value)) return null;
  if (isLegacyMember(value) && !isClassKit(value)) return fromLegacy(value, index);

  const kit = value as ClassKit;
  const record = value as { id?: unknown; equipment?: unknown };
  const id = typeof record.id === "string" && record.id.length > 0 ? record.id : `char-${index + 1}`;
  const draft: CharacterDraft = {
    ...kit,
    id,
    equipment: parseEquipment(record.equipment),
  };
  return refreshCombat(draft);
}

export function loadPersistedGroup(): Character[] {
  const fallback = DEFAULT_GROUP.map((member) => refreshCombat({ ...member, equipment: { ...member.equipment } }));

  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(GROUP_STORAGE_KEY);
    if (!stored) return fallback;

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;

    const members = parsed.map(parseMember);
    if (members.some((member) => member === null)) return fallback;

    return members as Character[];
  } catch {
    return fallback;
  }
}

export function persistGroup(group: Character[]): void {
  if (typeof window === "undefined") return;

  try {
    const stored = group.map((member) => ({
      id: member.id,
      unitClass: member.unitClass,
      subclass: member.subclass,
      equipment: member.equipment,
    }));
    window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage can be unavailable or full; the in-memory group remains usable.
  }
}

export function replaceGroupMember(group: Character[], index: number, member: Character): Character[] {
  return group.map((current, i) => (i === index ? member : current));
}

export type { UnitClass };
