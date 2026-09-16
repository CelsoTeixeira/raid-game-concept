import type { SpecDef } from "./classes";
import type { Attributes, RangeType, Stats } from "./types";

/** Pixel size of one pathfinding cell. Ranged combat uses world px; melee uses `MELEE_REACH`. */
export const TILE = 32;
export const COLS = 30;
export const ROWS = 18;
export const MELEE_RANGE = 40;
/** World-px melee reach (about one tile). Used for swings and enemy ring standoff. */
export const MELEE_REACH = TILE * 1.15;
export const RANGED_RANGE = 150;
export const HEAL_MANA_COST = 8;
/** Splash radius around a tank swing; extra enemies take half power and full tank threat. */
export const TANK_CLEAVE_RANGE = TILE * 1.75;
export const TANK_CLEAVE_POWER = 0.5;
/** Healer mana per second. Independent of the attack/heal clock. */
export const HEALER_MANA_REGEN = 5;
/** Threat written on a hit. Heals write none. */
export const TANK_THREAT = 3;
export const DPS_THREAT = 1;
export const HEALER_THREAT = 1;
export const MAX_FRIENDLIES = 10;
/** Idle enemies pull when a living friendly is this close (world px). */
export const ENEMY_ENGAGE_RANGE = TILE * 5;
/** Idle packmates join combat if this close to an already-engaged enemy. */
export const ENEMY_SOCIAL_RANGE = TILE * 4;
/** Min world-px gap between different enemy packs so a pull does not chain. */
export const ENEMY_GROUP_SEPARATION = ENEMY_SOCIAL_RANGE;

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

export const BASE_HEALTH = 20;
export const HEALTH_PER_VITALITY = 10;

export function maxHealthFrom(vitality: number): number {
  return BASE_HEALTH + vitality * HEALTH_PER_VITALITY;
}

export function attackPowerFrom(attributes: Attributes, spec: SpecDef): number {
  const { strength, agility, intelligence } = attributes;
  return Math.max(
    1,
    Math.round(
      strength * (spec.attackFrom.strength ?? 0) +
        agility * (spec.attackFrom.agility ?? 0) +
        intelligence * (spec.attackFrom.intelligence ?? 0),
    ),
  );
}

export function magicPowerFrom(intelligence: number, spec: SpecDef): number {
  return Math.round(intelligence * spec.healFromInt);
}

export function combatStatsFrom(spec: SpecDef, attributes: Attributes = spec.attributes): Stats {
  const maxHealth = maxHealthFrom(attributes.vitality);
  return {
    health: maxHealth,
    maxHealth,
    mana: spec.maxMana,
    maxMana: spec.maxMana,
    manaRegen: spec.manaRegen,
    movementSpeed: spec.movementSpeed,
    armor: spec.armor,
    attackPower: attackPowerFrom(attributes, spec),
    magicPower: magicPowerFrom(attributes.intelligence, spec),
    attackSpeed: spec.attackSpeed,
  };
}

export function makeEnemyStats(): Stats {
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
    manaRegen: 0,
  };
}
