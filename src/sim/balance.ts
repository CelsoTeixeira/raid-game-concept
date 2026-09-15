import type { RangeType, Role, Side, Stats } from "./types";

/** Pixel size of one pathfinding cell. Ranged combat uses world px; melee attacks use adjacent tiles. */
export const TILE = 32;
export const COLS = 30;
export const ROWS = 18;
export const MELEE_RANGE = 40;
export const RANGED_RANGE = 150;
export const HEAL_MANA_COST = 8;
/** Threat written on a hit. Heals write none. */
export const TANK_THREAT = 3;
export const DPS_THREAT = 1;
export const HEALER_THREAT = 1;
export const MAX_FRIENDLIES = 10;

export function attackRange(rangeType: RangeType): number {
  return rangeType === "ranged" ? RANGED_RANGE : MELEE_RANGE;
}

/** `max(1, attackPower - armor)` — a hit always chips. */
export function incomingDamage(attackPower: number, armor: number): number {
  return Math.max(1, attackPower - armor);
}

/** One shared attack/heal clock: `1000 / attackSpeed` ms, speed floored at 0.2. */
export function cooldownMs(attackSpeed: number): number {
  return 1000 / Math.max(0.2, attackSpeed);
}

export function makeStats(side: Side, role: Role, rangeType: RangeType): Stats {
  if (side === "enemy") {
    return {
      health: 45,
      maxHealth: 45,
      mana: 0,
      maxMana: 0,
      movementSpeed: 70,
      armor: 1,
      attackPower: 9,
      magicPower: 0,
      attackSpeed: 0.7,
    };
  }
  if (role === "tank") {
    return {
      health: 220,
      maxHealth: 220,
      mana: 0,
      maxMana: 0,
      movementSpeed: 85,
      armor: 10,
      attackPower: 8,
      magicPower: 0,
      attackSpeed: 0.9,
    };
  }
  if (role === "healer") {
    const ranged = rangeType === "ranged";
    return {
      health: ranged ? 75 : 90,
      maxHealth: ranged ? 75 : 90,
      mana: 120,
      maxMana: 120,
      movementSpeed: ranged ? 95 : 100,
      armor: 2,
      attackPower: 6,
      magicPower: 22,
      attackSpeed: 1,
    };
  }
  const ranged = rangeType === "ranged";
  return {
    health: ranged ? 65 : 80,
    maxHealth: ranged ? 65 : 80,
    mana: 0,
    maxMana: 0,
    movementSpeed: ranged ? 100 : 110,
    armor: ranged ? 1 : 2,
    attackPower: ranged ? 15 : 18,
    magicPower: 0,
    attackSpeed: ranged ? 0.95 : 1.15,
  };
}
