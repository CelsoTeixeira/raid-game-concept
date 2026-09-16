import { CLASS_SPECS, isUnitClass, type GroupMember, type UnitClass } from "./classes";
import type { RangeType, Role } from "./types";

export type { GroupMember } from "./classes";

/** Default group for 5-man content. */
export const DEFAULT_GROUP: GroupMember[] = [
  { unitClass: "paladin", subclass: "protection" },
  { unitClass: "warrior", subclass: "arms" },
  { unitClass: "rogue", subclass: "assassination" },
  { unitClass: "mage", subclass: "fire" },
  { unitClass: "priest", subclass: "holy" },
];

const GROUP_STORAGE_KEY = "raid-game.group.v2";

function isGroupMember(value: unknown): value is GroupMember {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const member = value as { unitClass?: unknown; subclass?: unknown };
  if (!isUnitClass(member.unitClass) || typeof member.subclass !== "string") return false;
  return member.subclass in CLASS_SPECS[member.unitClass];
}

function isLegacyMember(value: unknown): value is { role: Role; rangeType: RangeType } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const member = value as { role?: unknown; rangeType?: unknown };
  return (
    (member.role === "tank" || member.role === "healer" || member.role === "dps") &&
    (member.rangeType === "melee" || member.rangeType === "ranged")
  );
}

function fromLegacy(member: { role: Role; rangeType: RangeType }): GroupMember {
  if (member.role === "tank") return { unitClass: "paladin", subclass: "protection" };
  if (member.role === "healer") {
    return member.rangeType === "melee"
      ? { unitClass: "paladin", subclass: "holy" }
      : { unitClass: "priest", subclass: "holy" };
  }
  if (member.rangeType === "ranged") return { unitClass: "mage", subclass: "fire" };
  return { unitClass: "warrior", subclass: "arms" };
}

function parseMember(value: unknown): GroupMember | null {
  if (isGroupMember(value)) return { unitClass: value.unitClass, subclass: value.subclass } as GroupMember;
  if (isLegacyMember(value)) return fromLegacy(value);
  return null;
}

export function loadPersistedGroup(): GroupMember[] {
  const fallback = DEFAULT_GROUP.map((member) => ({ ...member }));

  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(GROUP_STORAGE_KEY);
    if (!stored) return fallback;

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;

    const members = parsed.map(parseMember);
    if (members.some((member) => member === null)) return fallback;

    return members as GroupMember[];
  } catch {
    return fallback;
  }
}

export function persistGroup(group: GroupMember[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(group));
  } catch {
    // Storage can be unavailable or full; the in-memory group remains usable.
  }
}

export function replaceGroupMember(group: GroupMember[], index: number, member: GroupMember): GroupMember[] {
  return group.map((current, i) => (i === index ? member : current));
}

export type { UnitClass };
