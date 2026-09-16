import type { CharacterAppearance } from "../appearance";
import type { UnitClass } from "./classes";
import type { WorldPoint } from "./nav";
import type { Attributes, RangeType, Role, Side, Stats } from "./types";

/** Player click order. Cleared on move. */
export type UnitOrder =
  | { kind: "attack"; targetId: string }
  | { kind: "heal"; targetId: string };

/** Enemy brain. Friendlies stay `idle`. */
export type UnitAi = "idle" | "combat";

/**
 * Phaser-free unit.
 * `threat` is meaningful on enemies (attacker id → value). Friendlies keep an empty map.
 */
export type SimUnit = {
  id: string;
  side: Side;
  role: Role;
  rangeType: RangeType;
  unitClass: UnitClass | null;
  subclass: string | null;
  attributes: Attributes;
  appearance: CharacterAppearance;
  stats: Stats;
  /** Hold-fire: skips auto-attack. Healers still heal unless they have an attack order. */
  autoAttack: boolean;
  selected: boolean;
  /** Remaining ms on the single attack/heal clock. */
  cooldown: number;
  /** Upcoming world points. */
  path: WorldPoint[];
  /** Click-to-heal / click-to-attack. Null means auto-acquire. */
  order: UnitOrder | null;
  /** Enemies: stand until pulled, then chase. Friendlies unused. */
  ai: UnitAi;
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
