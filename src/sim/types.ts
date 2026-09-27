export type Side = "friendly" | "enemy";
/** Behavior order picked on the group screen. Grants no stats. */
export type Role = "tank" | "healer" | "dps";

export type PrimaryStat = "vitality" | "intelligence" | "strength" | "agility";

export type Attributes = {
  vitality: number;
  intelligence: number;
  strength: number;
  agility: number;
};

/**
 * Derived from attributes and gear by `deriveStats`.
 * `attackSpeed` is hits per second on the shared clock. `attackRange` is world px.
 * `healPower` is 0 without healing gear. `threat` multiplies damage into threat.
 * `cleave` is the fraction of attack power splashed onto nearby enemies.
 */
export type Stats = {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  manaRegen: number;
  movementSpeed: number;
  armor: number;
  attackPower: number;
  attackSpeed: number;
  attackRange: number;
  healPower: number;
  threat: number;
  cleave: number;
};

export type UnitSnapshot = {
  id: string;
  side: Side;
  role: Role;
  ranged: boolean;
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
