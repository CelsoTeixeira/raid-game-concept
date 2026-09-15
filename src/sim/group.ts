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
