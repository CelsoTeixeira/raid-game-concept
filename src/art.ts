import { ARMOR_FAMILIES, type ArmorFamily, type GearKindId } from "./sim/gearKinds";
import type { Rng } from "./sim/items";
import type { Sex } from "./sim/names";

/**
 * Layered character art exported by the vault generator (`gk-test/export.py`).
 * Sheet rows and columns follow the orders below; keep them in sync with the exporter.
 */
export const ART_CELL = { width: 38, height: 40 } as const;

export const BODY_BUILDS = ["skinny", "normal", "fat"] as const;
export type BodyBuild = (typeof BODY_BUILDS)[number];

export const SKINS = ["light", "mid", "dark"] as const;
export type Skin = (typeof SKINS)[number];

export const HAIR_COLORS = ["brown", "black", "blonde", "ginger", "ash"] as const;
export type HairColor = (typeof HAIR_COLORS)[number];

export const HAIR_STYLES = ["sweep", "long", "bob", "cropBeard", "sweepBeard"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

const HAIR_BY_SEX: Record<Sex, readonly HairStyle[]> = {
  male: ["sweep", "long", "cropBeard", "sweepBeard"],
  female: ["sweep", "long", "bob"],
};

export type ArtLook = { build: BodyBuild; skin: Skin; hairStyle: HairStyle; hairColor: HairColor };

/** Worn armor subfamily per piece; null is the plain fallback (no helmet for the head). */
export type ArtOutfit = { chest: ArmorFamily | null; pants: ArmorFamily | null; helmet: ArmorFamily | null };

export const PLAIN_OUTFIT: ArtOutfit = { chest: null, pants: null, helmet: null };

function pick<T>(rng: Rng, values: readonly T[]): T {
  return values[Math.floor(rng.next() * values.length)]!;
}

export function rollArtLook(rng: Rng, sex: Sex): ArtLook {
  return {
    build: pick(rng, BODY_BUILDS),
    skin: pick(rng, SKINS),
    hairStyle: pick(rng, HAIR_BY_SEX[sex]),
    hairColor: pick(rng, HAIR_COLORS),
  };
}

const SHEETS = {
  body: { url: new URL("./assets/art/characters/body.png", import.meta.url).href, cols: SKINS.length, rows: 6 },
  face: { url: new URL("./assets/art/characters/face.png", import.meta.url).href, cols: SKINS.length, rows: 6 },
  chest: { url: new URL("./assets/art/characters/chest.png", import.meta.url).href, cols: 5, rows: 6 },
  pants: { url: new URL("./assets/art/characters/pants.png", import.meta.url).href, cols: 5, rows: 6 },
  helmet: { url: new URL("./assets/art/characters/helmet.png", import.meta.url).href, cols: 4, rows: 6 },
  hair: {
    url: new URL("./assets/art/characters/hair.png", import.meta.url).href,
    cols: HAIR_COLORS.length,
    rows: 6 * HAIR_STYLES.length,
  },
};

export type ArtLayer = { url: string; cols: number; rows: number; col: number; row: number };

function frame(sheet: keyof typeof SHEETS, col: number, row: number): ArtLayer {
  return { ...SHEETS[sheet], col, row };
}

/** Bottom to top: body, pants, chest, face, hair, helmet. */
export function artLayers(sex: Sex, look: ArtLook, outfit: ArtOutfit): ArtLayer[] {
  const build = (sex === "male" ? 0 : BODY_BUILDS.length) + BODY_BUILDS.indexOf(look.build);
  const skin = SKINS.indexOf(look.skin);
  const outfitCol = (family: ArmorFamily | null) => (family ? ARMOR_FAMILIES.indexOf(family) + 1 : 0);
  const layers = [
    frame("body", skin, build),
    frame("pants", outfitCol(outfit.pants), build),
    frame("chest", outfitCol(outfit.chest), build),
    frame("face", skin, build),
    frame("hair", HAIR_COLORS.indexOf(look.hairColor), build * HAIR_STYLES.length + HAIR_STYLES.indexOf(look.hairStyle)),
  ];
  if (outfit.helmet) layers.push(frame("helmet", ARMOR_FAMILIES.indexOf(outfit.helmet), build));
  return layers;
}

/** Armor kinds have one icon per subfamily. */
export function itemIconUrl(kind: GearKindId, family?: ArmorFamily): string {
  const name = family ? `${kind}_${family}` : kind;
  return new URL(`./assets/art/items/${name}.png`, import.meta.url).href;
}
