/** Pixel size of one pathfinding cell. Attack reach is world px from `Stats.attackRange`. */
export const TILE = 32;
export const COLS = 30;
export const ROWS = 18;
/** World-px melee reach (about one tile). Melee weapons and enemy claws use this range. */
export const MELEE_REACH = TILE * 1.15;
/** Heal reach in world px, independent of the weapon. */
export const HEAL_RANGE = 150;
export const HEAL_MANA_COST = 8;
/** Healer-role units auto-heal allies below this health fraction. */
export const HEAL_BELOW = 0.8;
/** Splash radius around a cleaving swing. */
export const CLEAVE_RANGE = TILE * 1.75;
export const MAX_FRIENDLIES = 10;
/** Idle enemies pull when a living friendly is this close (world px). */
export const ENEMY_ENGAGE_RANGE = TILE * 5;
/** Idle packmates join combat if this close to an already-engaged enemy. */
export const ENEMY_SOCIAL_RANGE = TILE * 4;
/** Min world-px gap between different enemy packs so a pull does not chain. */
export const ENEMY_GROUP_SEPARATION = ENEMY_SOCIAL_RANGE;

/** One shared attack/heal clock: `1000 / attackSpeed` ms, speed floored at 0.2. */
export function cooldownMs(attackSpeed: number): number {
  return 1000 / Math.max(0.2, attackSpeed);
}
