import {
  attackRange,
  cooldownMs,
  DPS_THREAT,
  HEAL_MANA_COST,
  HEALER_THREAT,
  incomingDamage,
  TANK_THREAT,
} from "./balance";
import type { Side } from "./types";
import type { SimUnit } from "./unit";

export function dist(a: SimUnit, b: SimUnit): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function living(units: SimUnit[], side?: Side): SimUnit[] {
  return units.filter((u) => u.stats.health > 0 && (side === undefined || u.side === side));
}

/**
 * Closest living unit of `side` within `range` (world px). Ties keep the later scan.
 * `range` is both the cutoff and the initial best distance.
 */
export function nearestLiving(
  units: SimUnit[],
  from: SimUnit,
  side: Side,
  range: number,
): SimUnit | null {
  let best: SimUnit | null = null;
  let bestD = range;
  for (const u of units) {
    if (u.side !== side || u.stats.health <= 0 || u.id === from.id) continue;
    const d = dist(from, u);
    if (d <= bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

/** Highest threat living friendly, else nearest. Drops stale ids from `u.threat`. */
export function enemyTarget(units: SimUnit[], u: SimUnit): SimUnit | null {
  let bestId: string | null = null;
  let best = -1;
  for (const [id, v] of u.threat) {
    const f = units.find((x) => x.id === id && x.side === "friendly" && x.stats.health > 0);
    if (!f) {
      u.threat.delete(id);
      continue;
    }
    if (v > best) {
      best = v;
      bestId = id;
    }
  }
  if (bestId) return units.find((x) => x.id === bestId) ?? null;
  return nearestLiving(units, u, "friendly", 1e9);
}

/** Armor damage. Friendly→enemy hits add tank 3 / healer-or-dps 1 threat. */
export function strike(attacker: SimUnit, defender: SimUnit): void {
  defender.stats.health -= incomingDamage(attacker.stats.attackPower, defender.stats.armor);
  if (attacker.side === "friendly" && defender.side === "enemy") {
    const add =
      attacker.role === "tank" ? TANK_THREAT : attacker.role === "healer" ? HEALER_THREAT : DPS_THREAT;
    defender.threat.set(attacker.id, (defender.threat.get(attacker.id) ?? 0) + add);
  }
}

/** Lowest-hp damaged friendly in heal range. Spends mana, does not write threat. */
export function tryHeal(units: SimUnit[], healer: SimUnit): boolean {
  if (healer.stats.mana < HEAL_MANA_COST) return false;
  const range = attackRange(healer.rangeType);
  let best: SimUnit | null = null;
  for (const f of living(units, "friendly")) {
    if (f.stats.health >= f.stats.maxHealth) continue;
    if (dist(healer, f) > range) continue;
    if (!best || f.stats.health < best.stats.health) best = f;
  }
  if (!best) return false;
  healer.stats.mana -= HEAL_MANA_COST;
  best.stats.health = Math.min(best.stats.maxHealth, best.stats.health + healer.stats.magicPower);
  return true;
}

/**
 * One clock tick while idle. Enemies melee their threat target.
 * Healers heal first (even if auto-attack is off), then weaker auto-attack.
 */
export function act(units: SimUnit[], u: SimUnit): void {
  if (u.side === "enemy") {
    const target = enemyTarget(units, u);
    if (!target) return;
    if (dist(u, target) > attackRange("melee")) return;
    strike(u, target);
    u.cooldown = cooldownMs(u.stats.attackSpeed);
    return;
  }
  if (u.role === "healer" && tryHeal(units, u)) {
    u.cooldown = cooldownMs(u.stats.attackSpeed);
    return;
  }
  if (!u.autoAttack) return;
  const target = nearestLiving(units, u, "enemy", attackRange(u.rangeType));
  if (!target) return;
  strike(u, target);
  u.cooldown = cooldownMs(u.stats.attackSpeed);
}
