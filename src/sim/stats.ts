import { MELEE_REACH } from "./balance";
import type { Rng } from "./items";
import type { Attributes, PrimaryStat, Stats } from "./types";

export const PRIMARY_STATS: PrimaryStat[] = ["vitality", "strength", "agility", "intelligence"];

export const STAT_LABELS: Record<PrimaryStat, string> = {
  vitality: "Vitality",
  intelligence: "Intelligence",
  strength: "Strength",
  agility: "Agility",
};

/** Same meaning for every character. */
export const STAT_HELPS: Record<PrimaryStat, string> = {
  vitality: "Health",
  strength: "Sword, axe, mace, and unarmed damage",
  agility: "Dagger and bow damage, attack and move speed",
  intelligence: "Staff and wand damage, mana, healing",
};

export type PowerStat = Exclude<PrimaryStat, "vitality">;

/** How a main-hand weapon attacks. Attack power is `damage + attributes[scaling]`. */
export type WeaponProfile = {
  scaling: PowerStat;
  damage: number;
  /** Hits per second before agility. */
  speed: number;
  /** World px. */
  range: number;
  /** Fraction of attack power splashed onto nearby enemies. */
  cleave: number;
};

export const UNARMED: WeaponProfile = {
  scaling: "strength",
  damage: 1,
  speed: 1,
  range: MELEE_REACH,
  cleave: 0,
};

/** Non-attribute bonuses summed from equipped gear. `threat` is percent. */
export type GearTotals = {
  armor: number;
  threat: number;
  healing: number;
};

export const NO_GEAR: GearTotals = { armor: 0, threat: 0, healing: 0 };

export const BASE_HEALTH = 20;
export const HEALTH_PER_VITALITY = 10;
export const MANA_PER_INTELLIGENCE = 12;
export const MANA_REGEN_PER_INTELLIGENCE = 0.5;
export const BASE_MOVEMENT_SPEED = 80;
export const MOVEMENT_PER_AGILITY = 2;
/** Each agility point adds this fraction to weapon speed. */
export const ATTACK_SPEED_PER_AGILITY = 0.01;
/** Armor at which half of incoming damage is mitigated. */
export const ARMOR_HALF_POINT = 40;

/** Units whose reach clearly exceeds melee fight from range (projectile fx, back rank). */
export function isRanged(stats: Pick<Stats, "attackRange">): boolean {
  return stats.attackRange > MELEE_REACH * 2;
}

export function armorMitigation(armor: number): number {
  const value = Math.max(0, armor);
  return value / (value + ARMOR_HALF_POINT);
}

/** Armor mitigates a fraction; a hit always chips at least 1. */
export function incomingDamage(power: number, armor: number): number {
  return Math.max(1, Math.round(power * (1 - armorMitigation(armor))));
}

export function deriveStats(attributes: Attributes, weapon: WeaponProfile, gear: GearTotals): Stats {
  const { vitality, intelligence, agility } = attributes;
  const maxHealth = BASE_HEALTH + vitality * HEALTH_PER_VITALITY;
  const maxMana = intelligence * MANA_PER_INTELLIGENCE;
  return {
    health: maxHealth,
    maxHealth,
    mana: maxMana,
    maxMana,
    manaRegen: intelligence * MANA_REGEN_PER_INTELLIGENCE,
    movementSpeed: BASE_MOVEMENT_SPEED + agility * MOVEMENT_PER_AGILITY,
    armor: gear.armor,
    attackPower: Math.max(1, weapon.damage + attributes[weapon.scaling]),
    attackSpeed: Math.round(weapon.speed * (1 + agility * ATTACK_SPEED_PER_AGILITY) * 100) / 100,
    attackRange: weapon.range,
    healPower: gear.healing > 0 ? gear.healing + intelligence : 0,
    threat: 1 + gear.threat / 100,
    cleave: weapon.cleave,
  };
}

export function addAttributes(a: Attributes, b: Partial<Attributes>): Attributes {
  return {
    vitality: a.vitality + (b.vitality ?? 0),
    intelligence: a.intelligence + (b.intelligence ?? 0),
    strength: a.strength + (b.strength ?? 0),
    agility: a.agility + (b.agility ?? 0),
  };
}

export const BASE_ATTRIBUTE_FLOOR = 3;
export const BASE_ATTRIBUTE_POINTS = 20;

/**
 * Every stat starts at the floor; the rest lands by per-character weights so each roll
 * leans somewhere without a fixed archetype.
 */
export function rollBaseAttributes(rng: Rng): Attributes {
  const weights = PRIMARY_STATS.map(() => 0.5 + rng.next() * 2);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const attributes: Attributes = {
    vitality: BASE_ATTRIBUTE_FLOOR,
    intelligence: BASE_ATTRIBUTE_FLOOR,
    strength: BASE_ATTRIBUTE_FLOOR,
    agility: BASE_ATTRIBUTE_FLOOR,
  };
  for (let point = 0; point < BASE_ATTRIBUTE_POINTS; point += 1) {
    let roll = rng.next() * total;
    let index = 0;
    while (index < weights.length - 1 && roll >= weights[index]!) {
      roll -= weights[index]!;
      index += 1;
    }
    attributes[PRIMARY_STATS[index]!] += 1;
  }
  return attributes;
}

export const ENEMY_ATTRIBUTES: Attributes = {
  vitality: 3,
  intelligence: 0,
  strength: 8,
  agility: 0,
};

export const ENEMY_CLAWS: WeaponProfile = {
  scaling: "strength",
  damage: 2,
  speed: 0.7,
  range: MELEE_REACH,
  cleave: 0,
};

export function enemyStats(): Stats {
  return deriveStats(ENEMY_ATTRIBUTES, ENEMY_CLAWS, NO_GEAR);
}
