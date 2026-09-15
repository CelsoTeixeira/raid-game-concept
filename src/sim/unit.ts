import type { WorldPoint } from "./nav";
import type { RangeType, Role, Side, Stats } from "./types";

/**
 * Phaser-free unit.
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
  /** Upcoming world points. */
  path: WorldPoint[];
  threat: Map<string, number>;
  x: number;
  y: number;
};

/** World-space landing for a selected unit (preview and order share this). */
export type MoveAssign = {
  unit: SimUnit;
  goal: WorldPoint;
  label: string;
};
