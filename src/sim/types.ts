export type Side = "friendly" | "enemy";
export type Role = "tank" | "healer" | "dps";
/** Tanks and enemies are always melee regardless of spawn args. */
export type RangeType = "melee" | "ranged";

export type PrimaryStat = "vitality" | "intelligence" | "strength" | "agility";

export type Attributes = {
  vitality: number;
  intelligence: number;
  strength: number;
  agility: number;
};

/** `attackSpeed` is hits per second on the shared clock. `magicPower` is heal amount. `manaRegen` is mana per second. */
export type Stats = {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  manaRegen: number;
  movementSpeed: number;
  armor: number;
  attackPower: number;
  magicPower: number;
  attackSpeed: number;
};

export type UnitSnapshot = {
  id: string;
  side: Side;
  role: Role;
  rangeType: RangeType;
  unitClass: string | null;
  subclass: string | null;
  autoAttack: boolean;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  selected: boolean;
  threatTargetId: string | null;
  threatValue: number;
};

export type HudState = {
  selected: UnitSnapshot[];
  friendlyAlive: number;
  enemyAlive: number;
  threatLines: string[];
  formation: string;
};
