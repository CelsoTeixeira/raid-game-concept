import {
  createCharacter,
  EQUIPMENT_SLOTS,
  emptyEquipment,
  refreshCombat,
  slotsForItem,
  type Character,
  type Equipment,
  type EquipmentSlot,
} from "./character";
import type { GearKindId } from "./gearKinds";
import { parseGearItem } from "./inventory";
import { generateGear, mulberry32 } from "./items";
import { PRIMARY_STATS, rollBaseAttributes } from "./stats";
import type { Attributes, Role } from "./types";

export type { Character } from "./character";
export type GroupMember = Character;

const DEFAULT_PLANS: readonly { role: Role; kinds: Partial<Record<EquipmentSlot, GearKindId>> }[] = [
  { role: "tank", kinds: { mainHand: "sword", offHand: "shield", chest: "chest" } },
  { role: "dps", kinds: { mainHand: "axe" } },
  { role: "dps", kinds: { mainHand: "dagger" } },
  { role: "dps", kinds: { mainHand: "staff" } },
  { role: "healer", kinds: { mainHand: "wand", offHand: "tome" } },
];

function defaultEquipment(index: number, kinds: Partial<Record<EquipmentSlot, GearKindId>>): Equipment {
  const rng = mulberry32(1000 + index);
  const equipment = emptyEquipment();
  for (const slot of EQUIPMENT_SLOTS) {
    const kind = kinds[slot];
    if (!kind) continue;
    equipment[slot] = generateGear({ rng, id: `gear-default-${index + 1}-${slot}`, rarity: "gray", kind });
  }
  return equipment;
}

/** Default group for 5-man content: seeded rolls, gray starter gear, roles picked for behavior. */
export const DEFAULT_GROUP: Character[] = DEFAULT_PLANS.map((plan, index) =>
  createCharacter({
    id: `char-${index + 1}`,
    role: plan.role,
    baseAttributes: rollBaseAttributes(mulberry32(index + 1)),
    equipment: defaultEquipment(index, plan.kinds),
  }),
);

const GROUP_STORAGE_KEY = "raid-game.group.v4";

function isRole(value: unknown): value is Role {
  return value === "tank" || value === "dps" || value === "healer";
}

function parseAttributes(value: unknown): Attributes | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const attributes: Attributes = { vitality: 0, intelligence: 0, strength: 0, agility: 0 };
  for (const stat of PRIMARY_STATS) {
    const amount = raw[stat];
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) return null;
    attributes[stat] = amount;
  }
  return attributes;
}

/** Drops items that fail validation, sit in the wrong slot, or repeat an id already seen. */
function parseEquipment(value: unknown, seen: Set<string>): Equipment {
  const equipment = emptyEquipment();
  if (typeof value !== "object" || value === null || Array.isArray(value)) return equipment;
  const raw = value as Partial<Record<EquipmentSlot, unknown>>;
  for (const slot of EQUIPMENT_SLOTS) {
    const item = parseGearItem(raw[slot]);
    if (!item || seen.has(item.id) || !slotsForItem(item.slot).includes(slot)) continue;
    seen.add(item.id);
    equipment[slot] = item;
  }
  return equipment;
}

function parseMember(value: unknown, index: number, seen: Set<string>): Character | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as { id?: unknown; role?: unknown; baseAttributes?: unknown; equipment?: unknown };
  const baseAttributes = parseAttributes(record.baseAttributes);
  if (!baseAttributes || !isRole(record.role)) return null;
  const id = typeof record.id === "string" && record.id.length > 0 ? record.id : `char-${index + 1}`;
  return refreshCombat({
    id,
    role: record.role,
    baseAttributes,
    equipment: parseEquipment(record.equipment, seen),
  });
}

/** Saved group with invalid members dropped; the default group when none survive. */
export function loadPersistedGroup(): Character[] {
  const fallback = DEFAULT_GROUP.map((member) => refreshCombat({ ...member, equipment: { ...member.equipment } }));

  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(GROUP_STORAGE_KEY);
    if (!stored) return fallback;

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return fallback;

    const seen = new Set<string>();
    const members = parsed
      .map((value, index) => parseMember(value, index, seen))
      .filter((member): member is Character => member !== null);
    return members.length > 0 ? members : fallback;
  } catch {
    return fallback;
  }
}

export function persistGroup(group: Character[]): void {
  if (typeof window === "undefined") return;

  try {
    const stored = group.map((member) => ({
      id: member.id,
      role: member.role,
      baseAttributes: member.baseAttributes,
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
