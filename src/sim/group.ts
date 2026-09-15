import type { RangeType, Role } from "./types";

export type GroupMember = { role: Role; rangeType: RangeType };

/** Default group for 5-man content. */
export const DEFAULT_GROUP: GroupMember[] = [
  { role: "tank", rangeType: "melee" },
  { role: "dps", rangeType: "melee" },
  { role: "dps", rangeType: "melee" },
  { role: "dps", rangeType: "ranged" },
  { role: "healer", rangeType: "ranged" },
];

const GROUP_STORAGE_KEY = "raid-game.group";

function isGroupMember(value: unknown): value is GroupMember {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

  const member = value as Partial<GroupMember>;
  return (
    (member.role === "tank" || member.role === "healer" || member.role === "dps") &&
    (member.rangeType === "melee" || member.rangeType === "ranged")
  );
}

export function loadPersistedGroup(): GroupMember[] {
  const fallback = DEFAULT_GROUP.map((member) => ({ ...member }));

  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(GROUP_STORAGE_KEY);
    if (!stored) return fallback;

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.every(isGroupMember)) return fallback;

    return parsed.map(({ role, rangeType }) => ({ role, rangeType }));
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
