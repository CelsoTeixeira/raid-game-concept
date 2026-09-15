import type { GridPoint } from "./grid";
import type { RangeType, Role, Side, Stats } from "./types";

/**
 * Phaser-free unit. Occupancy uses idle tiles only (`path.length === 0`).
 * `threat` is meaningful on enemies (attacker id → value). Friendlies keep an empty map.
 */
export type SimUnit = {
  id: string;
  side: Side;
  role: Role;
  rangeType: RangeType;
  stats: Stats;
  /** Hold-fire: skips auto-attack. Healers still heal. */
  autoAttack: boolean;
  selected: boolean;
  /** Remaining ms on the single attack/heal clock. */
  cooldown: number;
  /** Upcoming world points (tile centers for raid orders, ring slots for enemy chase). */
  path: { x: number; y: number }[];
  threat: Map<string, number>;
  x: number;
  y: number;
};

/** Unique landing tile for one selected unit in a group move / RMB preview. */
export type MoveAssign = {
  unit: SimUnit;
  goal: GridPoint;
};
