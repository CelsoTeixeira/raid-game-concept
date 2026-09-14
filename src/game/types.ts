export type Side = "friendly" | "enemy";
export type Role = "tank" | "healer" | "dps";
export type RangeType = "melee" | "ranged";

export type Stats = {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
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
};
