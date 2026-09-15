import {
  attackRange,
  cooldownMs,
  DPS_THREAT,
  HEAL_MANA_COST,
  HEALER_THREAT,
  incomingDamage,
  MELEE_REACH,
  TANK_CLEAVE_POWER,
  TANK_CLEAVE_RANGE,
  TANK_THREAT,
} from "./balance";
import type { Side } from "./types";
import type { SimUnit } from "./unit";

export function dist(a: SimUnit, b: SimUnit): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Melee: within `MELEE_REACH` world px. Ranged: pixel radius. */
export function canAttack(attacker: SimUnit, defender: SimUnit): boolean {
  if (attacker.rangeType === "ranged") return dist(attacker, defender) <= attackRange("ranged");
  return dist(attacker, defender) <= MELEE_REACH;
}

export function living(units: SimUnit[], side?: Side): SimUnit[] {
  return units.filter((u) => u.stats.health > 0 && (side === undefined || u.side === side));
}

/** Passive fill toward maxMana. Dead units and empty pools skip. */
export function regenMana(u: SimUnit, deltaMs: number): void {
  if (u.stats.maxMana <= 0 || u.stats.health <= 0) return;
  u.stats.mana = Math.min(u.stats.maxMana, u.stats.mana + u.stats.manaRegen * (deltaMs / 1000));
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
export function strike(attacker: SimUnit, defender: SimUnit, power = attacker.stats.attackPower): number {
  const amount = incomingDamage(power, defender.stats.armor);
  defender.stats.health -= amount;
  if (attacker.side === "friendly" && defender.side === "enemy") {
    const add =
      attacker.role === "tank" ? TANK_THREAT : attacker.role === "healer" ? HEALER_THREAT : DPS_THREAT;
    defender.threat.set(attacker.id, (defender.threat.get(attacker.id) ?? 0) + add);
  }
  return amount;
}

export type HitFx = {
  kind: "melee" | "ranged";
  attackerId: string;
  targetId: string;
  amount: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

export type ActFx = HealFx | HitFx;

export function isHealFx(fx: ActFx): fx is HealFx {
  return "healerId" in fx;
}

function hitFx(attacker: SimUnit, defender: SimUnit, amount: number): HitFx {
  return {
    kind: attacker.rangeType === "ranged" ? "ranged" : "melee",
    attackerId: attacker.id,
    targetId: defender.id,
    amount,
    fromX: attacker.x,
    fromY: attacker.y,
    toX: defender.x,
    toY: defender.y,
  };
}

function attackTarget(units: SimUnit[], from: SimUnit, side: Side): SimUnit | null {
  let best: SimUnit | null = null;
  let bestD = 1e9;
  for (const u of units) {
    if (u.side !== side || u.stats.health <= 0 || u.id === from.id) continue;
    if (!canAttack(from, u)) continue;
    const d = dist(from, u);
    if (d <= bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

function swing(u: SimUnit, target: SimUnit, units: SimUnit[]): HitFx[] {
  const fx: HitFx[] = [hitFx(u, target, strike(u, target))];
  u.cooldown = cooldownMs(u.stats.attackSpeed);
  if (u.role !== "tank") return fx;
  const splashPower = u.stats.attackPower * TANK_CLEAVE_POWER;
  for (const e of living(units, "enemy")) {
    if (e.id === target.id) continue;
    if (dist(u, e) > TANK_CLEAVE_RANGE) continue;
    fx.push(hitFx(u, e, strike(u, e, splashPower)));
  }
  return fx;
}

/** Instant heal for the view: bolt from healer to target, then floating `+amount`. */
export type HealFx = {
  healerId: string;
  targetId: string;
  amount: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

/** Lowest-hp damaged friendly in heal range. Spends mana, does not write threat. */
export function tryHeal(units: SimUnit[], healer: SimUnit): HealFx | null {
  if (healer.stats.mana < HEAL_MANA_COST) return null;
  const range = attackRange(healer.rangeType);
  let best: SimUnit | null = null;
  for (const f of living(units, "friendly")) {
    if (f.stats.health >= f.stats.maxHealth) continue;
    if (dist(healer, f) > range) continue;
    if (!best || f.stats.health < best.stats.health) best = f;
  }
  if (!best) return null;
  healer.stats.mana -= HEAL_MANA_COST;
  const before = best.stats.health;
  best.stats.health = Math.min(best.stats.maxHealth, best.stats.health + healer.stats.magicPower);
  const amount = Math.round(best.stats.health - before);
  if (amount <= 0) return null;
  return {
    healerId: healer.id,
    targetId: best.id,
    amount,
    fromX: healer.x,
    fromY: healer.y,
    toX: best.x,
    toY: best.y,
  };
}

/**
 * One clock tick while idle. Enemies melee their threat target in reach.
 * Healers heal first (even if auto-attack is off), then weaker auto-attack.
 * Tank swings cleave nearby enemies at half power (full tank threat each).
 */
export function act(units: SimUnit[], u: SimUnit): ActFx[] {
  if (u.side === "enemy") {
    const target = enemyTarget(units, u);
    if (!target || !canAttack(u, target)) return [];
    return swing(u, target, units);
  }
  if (u.role === "healer") {
    const heal = tryHeal(units, u);
    if (heal) {
      u.cooldown = cooldownMs(u.stats.attackSpeed);
      return [heal];
    }
  }
  if (!u.autoAttack) return [];
  const target = attackTarget(units, u, "enemy");
  if (!target) return [];
  return swing(u, target, units);
}
