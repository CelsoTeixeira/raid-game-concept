import { rollCharacterLook, type CharacterLook } from "../appearance";
import type { ItemRarity } from "./inventory";
import type { Rng } from "./items";
import { REGIONS, rollName, SEXES, type CharacterName, type Region, type Sex } from "./names";
import { rollBaseAttributes } from "./stats";
import type { Attributes } from "./types";

/** Base attribute points on top of the floor. Rarity touches stats only. */
export const CHARACTER_RARITY_POINTS: Record<ItemRarity, number> = {
  gray: 16,
  green: 20,
  blue: 25,
  purple: 31,
  orange: 38,
};

export type RolledCharacter = {
  name: CharacterName;
  sex: Sex;
  region: Region;
  rarity: ItemRarity;
  baseAttributes: Attributes;
  look: CharacterLook;
};

export function rollCharacter(options: {
  rng: Rng;
  rarity: ItemRarity;
  region?: Region;
  sex?: Sex;
  takenNames: ReadonlySet<string>;
}): RolledCharacter {
  const { rng, rarity, takenNames } = options;
  const region = options.region ?? REGIONS[Math.floor(rng.next() * REGIONS.length)]!;
  const sex = options.sex ?? SEXES[Math.floor(rng.next() * SEXES.length)]!;
  return {
    name: rollName({ rng, region, sex, takenNames }),
    sex,
    region,
    rarity,
    baseAttributes: rollBaseAttributes(rng, CHARACTER_RARITY_POINTS[rarity]),
    look: rollCharacterLook(rng, sex),
  };
}
