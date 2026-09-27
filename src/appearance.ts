import type { GearKindId } from "./sim/gearKinds";
import type { GroupMember } from "./sim/group";
import type { Rng } from "./sim/items";
import type { Sex } from "./sim/names";

export type SpriteFrame = { col: number; row: number };

export type CharacterAppearance = {
  body: SpriteFrame;
  clothing: SpriteFrame | null;
  pants: SpriteFrame | null;
  equipment: SpriteFrame[];
};

type AppearanceVariant = {
  body: SpriteFrame;
  clothing: SpriteFrame;
  pants: SpriteFrame;
};

const APPEARANCE_VARIANTS: AppearanceVariant[] = [
  {
    body: { col: 0, row: 0 },
    clothing: { col: 6, row: 0 },
    pants: { col: 3, row: 5 },
  },
  {
    body: { col: 0, row: 1 },
    clothing: { col: 10, row: 0 },
    pants: { col: 3, row: 6 },
  },
  {
    body: { col: 0, row: 2 },
    clothing: { col: 14, row: 0 },
    pants: { col: 3, row: 7 },
  },
];

export const ENEMY_APPEARANCE: CharacterAppearance = {
  body: { col: 0, row: 3 },
  clothing: null,
  pants: null,
  equipment: [],
};

/** Held-item sprites by gear kind. Worn kinds (chest, pants, jewelry, tome) draw nothing yet. */
const HELD_FRAMES: Partial<Record<GearKindId, SpriteFrame>> = {
  sword: { col: 44, row: 6 },
  axe: { col: 49, row: 1 },
  mace: { col: 47, row: 0 },
  dagger: { col: 44, row: 7 },
  bow: { col: 52, row: 0 },
  staff: { col: 42, row: 1 },
  wand: { col: 46, row: 2 },
  shield: { col: 37, row: 0 },
};

function equipmentFrames(member: GroupMember): SpriteFrame[] {
  const held = [member.equipment.mainHand, member.equipment.offHand];
  return held.flatMap((item) => {
    const frame = item ? HELD_FRAMES[item.kind] : undefined;
    return frame ? [frame] : [];
  });
}

export function getMemberAppearance(member: GroupMember, index: number): CharacterAppearance {
  const variant = APPEARANCE_VARIANTS[index % APPEARANCE_VARIANTS.length];
  return {
    body: variant.body,
    clothing: variant.clothing,
    pants: variant.pants,
    equipment: equipmentFrames(member),
  };
}

export function appearanceFrames(appearance: CharacterAppearance): SpriteFrame[] {
  const frames = [appearance.body];
  if (appearance.pants) frames.push(appearance.pants);
  if (appearance.clothing) frames.push(appearance.clothing);
  return [...frames, ...appearance.equipment];
}

/** Rolled per character. Sex only changes the hair pools. */
export type CharacterLook = {
  body: SpriteFrame;
  hair: SpriteFrame;
  facialHair: SpriteFrame | null;
};

/** Human skin tones only; the green body stays enemy-only. */
const SKIN_BODIES: readonly SpriteFrame[] = [
  { col: 0, row: 0 },
  { col: 0, row: 1 },
  { col: 0, row: 2 },
];

/** Top-left of each 4x4 hair block: brown, ginger, blonde, black, white. */
const HAIR_COLOR_BLOCKS: readonly SpriteFrame[] = [
  { col: 19, row: 0 },
  { col: 23, row: 0 },
  { col: 19, row: 4 },
  { col: 23, row: 4 },
  { col: 19, row: 8 },
];

/** Offsets inside a hair block. */
const HAIR = {
  short: { col: 0, row: 0 },
  long: { col: 1, row: 0 },
  parted: { col: 0, row: 1 },
  braids: { col: 1, row: 1 },
  sideBraid: { col: 2, row: 1 },
  twinBraids: { col: 3, row: 1 },
  topknot: { col: 1, row: 2 },
  bowl: { col: 2, row: 2 },
  balding: { col: 3, row: 2 },
  // Hair with facial hair drawn in.
  moustache: { col: 2, row: 0 },
  fullBeard: { col: 3, row: 0 },
  shortBeard: { col: 0, row: 2 },
} satisfies Record<string, SpriteFrame>;

const HAIR_BY_SEX: Record<Sex, readonly SpriteFrame[]> = {
  male: [
    HAIR.short,
    HAIR.long,
    HAIR.parted,
    HAIR.topknot,
    HAIR.bowl,
    HAIR.balding,
    HAIR.moustache,
    HAIR.fullBeard,
    HAIR.shortBeard,
  ],
  female: [HAIR.short, HAIR.long, HAIR.braids, HAIR.sideBraid, HAIR.twinBraids, HAIR.topknot, HAIR.bowl],
};

const HAIR_WITH_FACIAL: readonly SpriteFrame[] = [HAIR.moustache, HAIR.fullBeard, HAIR.shortBeard];

/** Facial-hair-only offsets: big beard, moustache, long beard, goatee. */
const FACIAL_HAIR: readonly SpriteFrame[] = [
  { col: 0, row: 3 },
  { col: 1, row: 3 },
  { col: 2, row: 3 },
  { col: 3, row: 3 },
];

const FACIAL_HAIR_CHANCE = 0.4;

/** Plain clothes so a rolled character is not drawn bare. */
const STARTER_CLOTHING: SpriteFrame = { col: 6, row: 0 };
const STARTER_PANTS: SpriteFrame = { col: 3, row: 5 };

function pickFrame(rng: Rng, frames: readonly SpriteFrame[]): SpriteFrame {
  return frames[Math.floor(rng.next() * frames.length)]!;
}

function inBlock(block: SpriteFrame, offset: SpriteFrame): SpriteFrame {
  return { col: block.col + offset.col, row: block.row + offset.row };
}

export function rollCharacterLook(rng: Rng, sex: Sex): CharacterLook {
  const body = pickFrame(rng, SKIN_BODIES);
  const block = pickFrame(rng, HAIR_COLOR_BLOCKS);
  const hair = pickFrame(rng, HAIR_BY_SEX[sex]);
  const canAddFacial = sex === "male" && !HAIR_WITH_FACIAL.includes(hair);
  const facialHair = canAddFacial && rng.next() < FACIAL_HAIR_CHANCE ? pickFrame(rng, FACIAL_HAIR) : null;
  return {
    body,
    hair: inBlock(block, hair),
    facialHair: facialHair ? inBlock(block, facialHair) : null,
  };
}

export function lookFrames(look: CharacterLook): SpriteFrame[] {
  const frames = [look.body, STARTER_PANTS, STARTER_CLOTHING];
  if (look.facialHair) frames.push(look.facialHair);
  return [...frames, look.hair];
}
