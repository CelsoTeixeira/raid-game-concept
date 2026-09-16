import type { Attributes, PrimaryStat, RangeType, Role } from "./types";

export const UNIT_CLASSES = ["warrior", "rogue", "mage", "priest", "paladin"] as const;
export type UnitClass = (typeof UNIT_CLASSES)[number];

export const PRIMARY_STATS: PrimaryStat[] = ["vitality", "strength", "agility", "intelligence"];

export const CLASS_LABELS: Record<UnitClass, string> = {
  warrior: "Warrior",
  rogue: "Rogue",
  mage: "Mage",
  priest: "Priest",
  paladin: "Paladin",
};

export const STAT_LABELS: Record<PrimaryStat, string> = {
  vitality: "Vitality",
  intelligence: "Intelligence",
  strength: "Strength",
  agility: "Agility",
};

export const STAT_HELPS: Record<PrimaryStat, string> = {
  vitality: "Health",
  intelligence: "Heals and caster damage",
  strength: "Physical damage",
  agility: "Physical damage",
};

export type PowerStat = Exclude<PrimaryStat, "vitality">;

export type SpecDef = {
  label: string;
  blurb: string;
  role: Role;
  rangeType: RangeType;
  attributes: Attributes;
  /** Strength / agility / intelligence weights that become attack power. */
  attackFrom: Partial<Record<PowerStat, number>>;
  /** Intelligence → heal amount. 0 for specs that do not heal. */
  healFromInt: number;
  powerStat: PowerStat;
  armor: number;
  movementSpeed: number;
  attackSpeed: number;
  maxMana: number;
  manaRegen: number;
};

export const ENEMY_ATTRIBUTES: Attributes = {
  vitality: 4,
  intelligence: 0,
  strength: 8,
  agility: 3,
};

function spec(def: SpecDef): SpecDef {
  return def;
}

/**
 * Friendly class kits. Combat numbers come from attributes:
 * vitality → health, intelligence → heals and caster DPS, strength/agility → physical DPS.
 */
export const CLASS_SPECS = {
  warrior: {
    arms: spec({
      label: "Arms",
      blurb: "Melee damage. Strength hits hard; agility adds a little.",
      role: "dps",
      rangeType: "melee",
      attributes: { vitality: 6, strength: 14, agility: 6, intelligence: 2 },
      attackFrom: { strength: 1.2, agility: 0.2 },
      healFromInt: 0,
      powerStat: "strength",
      armor: 2,
      movementSpeed: 110,
      attackSpeed: 1.15,
      maxMana: 0,
      manaRegen: 0,
    }),
    protection: spec({
      label: "Protection",
      blurb: "Melee tank. Vitality for health, strength for damage.",
      role: "tank",
      rangeType: "melee",
      attributes: { vitality: 20, strength: 8, agility: 4, intelligence: 2 },
      attackFrom: { strength: 0.625 },
      healFromInt: 0,
      powerStat: "strength",
      armor: 10,
      movementSpeed: 85,
      attackSpeed: 0.9,
      maxMana: 0,
      manaRegen: 0,
    }),
  },
  rogue: {
    assassination: spec({
      label: "Assassination",
      blurb: "Melee damage. Agility for damage.",
      role: "dps",
      rangeType: "melee",
      attributes: { vitality: 6, strength: 4, agility: 16, intelligence: 2 },
      attackFrom: { agility: 1.125 },
      healFromInt: 0,
      powerStat: "agility",
      armor: 2,
      movementSpeed: 110,
      attackSpeed: 1.15,
      maxMana: 0,
      manaRegen: 0,
    }),
  },
  mage: {
    fire: spec({
      label: "Fire",
      blurb: "Ranged damage. Intelligence for damage.",
      role: "dps",
      rangeType: "ranged",
      attributes: { vitality: 5, strength: 2, agility: 5, intelligence: 16 },
      attackFrom: { intelligence: 0.9375 },
      healFromInt: 0,
      powerStat: "intelligence",
      armor: 1,
      movementSpeed: 100,
      attackSpeed: 0.95,
      maxMana: 0,
      manaRegen: 0,
    }),
    frost: spec({
      label: "Frost",
      blurb: "Ranged damage. Intelligence for damage; a bit sturdier and slower.",
      role: "dps",
      rangeType: "ranged",
      attributes: { vitality: 6, strength: 2, agility: 4, intelligence: 16 },
      attackFrom: { intelligence: 0.8125 },
      healFromInt: 0,
      powerStat: "intelligence",
      armor: 2,
      movementSpeed: 95,
      attackSpeed: 0.9,
      maxMana: 0,
      manaRegen: 0,
    }),
    arcane: spec({
      label: "Arcane",
      blurb: "Ranged damage. Highest intelligence.",
      role: "dps",
      rangeType: "ranged",
      attributes: { vitality: 5, strength: 1, agility: 4, intelligence: 18 },
      attackFrom: { intelligence: 0.944 },
      healFromInt: 0,
      powerStat: "intelligence",
      armor: 1,
      movementSpeed: 100,
      attackSpeed: 1,
      maxMana: 0,
      manaRegen: 0,
    }),
  },
  priest: {
    holy: spec({
      label: "Holy",
      blurb: "Ranged healer. Intelligence for healing and a weak attack.",
      role: "healer",
      rangeType: "ranged",
      attributes: { vitality: 6, strength: 2, agility: 4, intelligence: 16 },
      attackFrom: { intelligence: 0.375 },
      healFromInt: 1.375,
      powerStat: "intelligence",
      armor: 2,
      movementSpeed: 95,
      attackSpeed: 1,
      maxMana: 120,
      manaRegen: 5,
    }),
  },
  paladin: {
    protection: spec({
      label: "Protection",
      blurb: "Melee tank. Vitality for health, strength for damage.",
      role: "tank",
      rangeType: "melee",
      attributes: { vitality: 20, strength: 8, agility: 3, intelligence: 3 },
      attackFrom: { strength: 0.625 },
      healFromInt: 0,
      powerStat: "strength",
      armor: 10,
      movementSpeed: 85,
      attackSpeed: 0.9,
      maxMana: 0,
      manaRegen: 0,
    }),
    retribution: spec({
      label: "Retribution",
      blurb: "Melee damage. Strength for damage.",
      role: "dps",
      rangeType: "melee",
      attributes: { vitality: 7, strength: 14, agility: 4, intelligence: 3 },
      attackFrom: { strength: 1.2, agility: 0.3 },
      healFromInt: 0,
      powerStat: "strength",
      armor: 3,
      movementSpeed: 105,
      attackSpeed: 1.1,
      maxMana: 0,
      manaRegen: 0,
    }),
    holy: spec({
      label: "Holy",
      blurb: "Melee healer. Intelligence for healing; strength chips in damage.",
      role: "healer",
      rangeType: "melee",
      attributes: { vitality: 8, strength: 6, agility: 4, intelligence: 14 },
      attackFrom: { strength: 0.5, intelligence: 0.2 },
      healFromInt: 1.571,
      powerStat: "intelligence",
      armor: 4,
      movementSpeed: 100,
      attackSpeed: 1,
      maxMana: 120,
      manaRegen: 5,
    }),
  },
} as const;

export type GroupMember = {
  [K in UnitClass]: { unitClass: K; subclass: keyof (typeof CLASS_SPECS)[K] & string };
}[UnitClass];

export function getSpec(member: GroupMember): SpecDef {
  const specs = CLASS_SPECS[member.unitClass] as Record<string, SpecDef>;
  return specs[member.subclass];
}

export function memberRole(member: GroupMember): Role {
  return getSpec(member).role;
}

export function memberRangeType(member: GroupMember): RangeType {
  return getSpec(member).rangeType;
}

export function classLabel(unitClass: UnitClass): string {
  return CLASS_LABELS[unitClass];
}

export function specLabel(member: GroupMember): string {
  return getSpec(member).label;
}

export function kitLabel(unitClass: string | null, subclass: string | null): string | null {
  if (!isUnitClass(unitClass) || !subclass) return null;
  const specs = CLASS_SPECS[unitClass] as Record<string, SpecDef>;
  const spec = specs[subclass];
  if (!spec) return null;
  return `${CLASS_LABELS[unitClass]} ${spec.label}`;
}

export function specIds(unitClass: UnitClass): string[] {
  return Object.keys(CLASS_SPECS[unitClass]);
}

export function memberWithClass(unitClass: UnitClass): GroupMember {
  const subclass = specIds(unitClass)[0];
  return { unitClass, subclass } as GroupMember;
}

export function memberWithSpec(unitClass: UnitClass, subclass: string): GroupMember {
  if (!specIds(unitClass).includes(subclass)) return memberWithClass(unitClass);
  return { unitClass, subclass } as GroupMember;
}

export function isUnitClass(value: unknown): value is UnitClass {
  return typeof value === "string" && (UNIT_CLASSES as readonly string[]).includes(value);
}
