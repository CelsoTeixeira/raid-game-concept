import {
  CLEAVE_RANGE,
  cooldownMs,
  ENEMY_ENGAGE_RANGE,
  ENEMY_SOCIAL_RANGE,
  HEAL_BELOW,
  HEAL_MANA_COST,
  HEAL_RANGE,
} from "./balance";
import { incomingDamage, isRanged } from "./stats";
import type { Side } from "./types";
import type { SimUnit } from "./unit";

export function dist(a: SimUnit, b: SimUnit): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Within the attacker's `attackRange` (world px). */
export function canAttack(attacker: SimUnit, defender: SimUnit): boolean {
  return dist(attacker, defender) <= attacker.stats.attackRange;
}

/** Any unit with healing gear can heal; only healer-role units do it on their own. */
export function canHeal(u: SimUnit): boolean {
  return u.stats.healPower > 0;
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

function pruneThreat(units: SimUnit[], u: SimUnit): void {
  for (const id of [...u.threat.keys()]) {
    const f = units.find((x) => x.id === id && x.side === "friendly" && x.stats.health > 0);
    if (!f) u.threat.delete(id);
  }
}

function hasAttackOrderOn(units: SimUnit[], enemyId: string): boolean {
  return living(units, "friendly").some((f) => f.order?.kind === "attack" && f.order.targetId === enemyId);
}

function shouldPull(units: SimUnit[], e: SimUnit): boolean {
  pruneThreat(units, e);
  if (e.threat.size > 0) return true;
  if (hasAttackOrderOn(units, e.id)) return true;
  if (nearestLiving(units, e, "friendly", ENEMY_ENGAGE_RANGE)) return true;
  for (const other of living(units, "enemy")) {
    if (other.id === e.id || other.ai !== "combat") continue;
    if (dist(e, other) <= ENEMY_SOCIAL_RANGE) return true;
  }
  return false;
}

/**
 * Idle until a friendly is in `ENEMY_ENGAGE_RANGE`, someone is attacking this unit,
 * threat exists, or a packmate is already in combat nearby. Combat holds until no
 * living friendlies remain — kiting does not drop aggro.
 */
export function updateEnemyAi(units: SimUnit[]): void {
  const anyFriendly = living(units, "friendly").length > 0;
  if (!anyFriendly) {
    for (const e of living(units, "enemy")) {
      if (e.ai === "combat") e.path = [];
      e.ai = "idle";
    }
    return;
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of living(units, "enemy")) {
      if (e.ai === "combat") continue;
      if (!shouldPull(units, e)) continue;
      e.ai = "combat";
      grew = true;
    }
  }
}

/** Highest living threat, else nearest while in combat. Idle enemies have no target. */
export function enemyTarget(units: SimUnit[], u: SimUnit): SimUnit | null {
  pruneThreat(units, u);
  let bestId: string | null = null;
  let best = -1;
  for (const [id, v] of u.threat) {
    if (v > best) {
      best = v;
      bestId = id;
    }
  }
  if (bestId) return units.find((x) => x.id === bestId) ?? null;
  if (u.ai !== "combat") return null;
  return nearestLiving(units, u, "friendly", 1e9);
}

/** Armor-mitigated damage. Friendly→enemy hits add `damage × threat` to the enemy's table. */
export function strike(attacker: SimUnit, defender: SimUnit, power = attacker.stats.attackPower): number {
  const amount = incomingDamage(power, defender.stats.armor);
  defender.stats.health -= amount;
  if (attacker.side === "friendly" && defender.side === "enemy") {
    const add = amount * attacker.stats.threat;
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
    kind: isRanged(attacker.stats) ? "ranged" : "melee",
    attackerId: attacker.id,
    targetId: defender.id,
    amount,
    fromX: attacker.x,
    fromY: attacker.y,
    toX: defender.x,
    toY: defender.y,
  };
}

/**
 * Enemy in reach to auto-attack. Tanks prefer enemies aimed at someone else (peel), then the
 * nearest; everyone else takes the nearest.
 */
function attackTarget(units: SimUnit[], from: SimUnit): SimUnit | null {
  let best: SimUnit | null = null;
  let bestScore = Infinity;
  for (const u of units) {
    if (u.side !== "enemy" || u.stats.health <= 0) continue;
    if (!canAttack(from, u)) continue;
    let score = dist(from, u);
    if (from.role === "tank" && enemyTarget(units, u)?.id === from.id) score += 1e6;
    if (score <= bestScore) {
      bestScore = score;
      best = u;
    }
  }
  return best;
}

function swing(u: SimUnit, target: SimUnit, units: SimUnit[]): HitFx[] {
  const fx: HitFx[] = [hitFx(u, target, strike(u, target))];
  u.cooldown = cooldownMs(u.stats.attackSpeed);
  if (u.stats.cleave <= 0) return fx;
  const opponents = u.side === "friendly" ? "enemy" : "friendly";
  const splashPower = u.stats.attackPower * u.stats.cleave;
  for (const e of living(units, opponents)) {
    if (e.id === target.id) continue;
    if (dist(u, e) > CLEAVE_RANGE) continue;
    fx.push(hitFx(u, e, strike(u, e, splashPower)));
  }
  return fx;
}

export type HealFx = {
  healerId: string;
  targetId: string;
  amount: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

function applyHeal(healer: SimUnit, target: SimUnit): HealFx | null {
  healer.stats.mana -= HEAL_MANA_COST;
  const before = target.stats.health;
  target.stats.health = Math.min(target.stats.maxHealth, target.stats.health + healer.stats.healPower);
  const amount = Math.round(target.stats.health - before);
  if (amount <= 0) return null;
  return {
    healerId: healer.id,
    targetId: target.id,
    amount,
    fromX: healer.x,
    fromY: healer.y,
    toX: target.x,
    toY: target.y,
  };
}

/** Heal a specific living damaged friendly in range. Spends mana, does not write threat. */
export function tryHealTarget(healer: SimUnit, target: SimUnit): HealFx | null {
  if (!canHeal(healer)) return null;
  if (target.side !== "friendly" || target.stats.health <= 0) return null;
  if (target.stats.health >= target.stats.maxHealth) return null;
  if (healer.stats.mana < HEAL_MANA_COST) return null;
  if (dist(healer, target) > HEAL_RANGE) return null;
  return applyHeal(healer, target);
}

/** Most-hurt friendly (by fraction) below `HEAL_BELOW` in heal range. Spends mana, no threat. */
export function tryHeal(units: SimUnit[], healer: SimUnit): HealFx | null {
  if (!canHeal(healer) || healer.stats.mana < HEAL_MANA_COST) return null;
  let best: SimUnit | null = null;
  let bestFraction = HEAL_BELOW;
  for (const f of living(units, "friendly")) {
    const fraction = f.stats.health / f.stats.maxHealth;
    if (fraction >= bestFraction) continue;
    if (dist(healer, f) > HEAL_RANGE) continue;
    bestFraction = fraction;
    best = f;
  }
  if (!best) return null;
  return applyHeal(healer, best);
}

function orderedTarget(units: SimUnit[], u: SimUnit): SimUnit | null {
  if (!u.order) return null;
  const target = units.find((x) => x.id === u.order?.targetId && x.stats.health > 0) ?? null;
  if (!target) u.order = null;
  return target;
}

/**
 * One clock tick while idle. Enemies attack their combat/threat target in reach.
 * A click order beats auto-acquire: heal that ally, or swing that enemy (even if auto-attack is off).
 * Healer-role units heal the most-hurt ally first, then attack. Tanks peel enemies off allies.
 * Cleaving weapons splash nearby enemies (threat per hit).
 */
export function act(units: SimUnit[], u: SimUnit): ActFx[] {
  if (u.side === "enemy") {
    const target = enemyTarget(units, u);
    if (!target || !canAttack(u, target)) return [];
    return swing(u, target, units);
  }
  const ordered = orderedTarget(units, u);
  if (u.order?.kind === "heal") {
    if (!ordered) return [];
    const heal = tryHealTarget(u, ordered);
    if (heal) {
      u.cooldown = cooldownMs(u.stats.attackSpeed);
      return [heal];
    }
    return [];
  }
  if (u.order?.kind === "attack") {
    if (!ordered || ordered.side !== "enemy" || !canAttack(u, ordered)) return [];
    return swing(u, ordered, units);
  }
  if (u.role === "healer") {
    const heal = tryHeal(units, u);
    if (heal) {
      u.cooldown = cooldownMs(u.stats.attackSpeed);
      return [heal];
    }
  }
  if (!u.autoAttack) return [];
  const target = attackTarget(units, u);
  if (!target) return [];
  return swing(u, target, units);
}
