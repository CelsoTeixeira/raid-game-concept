import type { Equipment, EquippedItem } from "./sim/character";
import { ARMOR_FAMILIES, isArmorFamily, type ArmorFamily, type GearKindId } from "./sim/gearKinds";
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

/** Held-item sheet columns: main-hand kinds, then off-hand kinds. */
export const HELD_KINDS = ["sword", "axe", "mace", "dagger", "bow", "staff", "wand", "shield", "tome"] as const;
export type HeldKind = (typeof HELD_KINDS)[number];

export function isHeldKind(kind: GearKindId): kind is HeldKind {
  return (HELD_KINDS as readonly string[]).includes(kind);
}

export type ArtLook = { build: BodyBuild; skin: Skin; hairStyle: HairStyle; hairColor: HairColor };

/** Worn armor subfamily per piece; null is the plain fallback (no helmet for the head, nothing held). */
export type ArtOutfit = {
  chest: ArmorFamily | null;
  pants: ArmorFamily | null;
  helmet: ArmorFamily | null;
  mainHand: HeldKind | null;
  offHand: HeldKind | null;
};

export const PLAIN_OUTFIT: ArtOutfit = { chest: null, pants: null, helmet: null, mainHand: null, offHand: null };

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

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export function parseArtLook(value: unknown): ArtLook | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { build, skin, hairStyle, hairColor } = value as Record<string, unknown>;
  if (!oneOf(BODY_BUILDS, build) || !oneOf(SKINS, skin)) return null;
  if (!oneOf(HAIR_STYLES, hairStyle) || !oneOf(HAIR_COLORS, hairColor)) return null;
  return { build, skin, hairStyle, hairColor };
}

/** Equipped chest, pants, and helmet pick the outfit by subfamily; held kinds draw in the hands (D4). */
export function outfitFromEquipment(equipment: Equipment): ArtOutfit {
  const family = (item: EquippedItem | null) => (item && isArmorFamily(item.armorFamily) ? item.armorFamily : null);
  const held = (item: EquippedItem | null) => (item && isHeldKind(item.kind) ? item.kind : null);
  return {
    chest: family(equipment.chest),
    pants: family(equipment.pants),
    helmet: family(equipment.head),
    mainHand: held(equipment.mainHand),
    offHand: held(equipment.offHand),
  };
}

const SHEETS = {
  body: { url: new URL("./assets/art/characters/body.png", import.meta.url).href, cols: SKINS.length, rows: 6 },
  face: { url: new URL("./assets/art/characters/face.png", import.meta.url).href, cols: SKINS.length, rows: 6 },
  chest: { url: new URL("./assets/art/characters/chest.png", import.meta.url).href, cols: 5, rows: 6 },
  pants: { url: new URL("./assets/art/characters/pants.png", import.meta.url).href, cols: 5, rows: 6 },
  helmet: { url: new URL("./assets/art/characters/helmet.png", import.meta.url).href, cols: 4, rows: 6 },
  held: { url: new URL("./assets/art/characters/held.png", import.meta.url).href, cols: HELD_KINDS.length, rows: 6 },
  hair: {
    url: new URL("./assets/art/characters/hair.png", import.meta.url).href,
    cols: HAIR_COLORS.length,
    rows: 6 * HAIR_STYLES.length,
  },
};

export type ArtLayer = { key: string; url: string; cols: number; rows: number; col: number; row: number };

function frame(sheet: keyof typeof SHEETS, col: number, row: number): ArtLayer {
  return { key: `${sheet}-${col}`, ...SHEETS[sheet], col, row };
}

/** Bottom to top: body, pants, chest, face, hair, helmet, main hand, off hand. */
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
  for (const held of [outfit.mainHand, outfit.offHand]) {
    if (held) layers.push(frame("held", HELD_KINDS.indexOf(held), build));
  }
  return layers;
}

/** Armor kinds have one icon per subfamily. */
export function itemIconUrl(kind: GearKindId, family?: ArmorFamily): string {
  const name = family ? `${kind}_${family}` : kind;
  return new URL(`./assets/art/items/${name}.png`, import.meta.url).href;
}
