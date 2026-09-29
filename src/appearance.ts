import type { HairColor, HairStyle, Skin } from "./art";
import type { GearKindId } from "./sim/gearKinds";
import type { GroupMember } from "./sim/group";

/**
 * Kenney 16px sheet frames for the Phaser field. Characters carry the layered art look;
 * until the field draws that art it shows a Kenney stand-in derived from it (D14).
 */
export type SpriteFrame = { col: number; row: number };

export type CharacterAppearance = {
  body: SpriteFrame;
  clothing: SpriteFrame | null;
  pants: SpriteFrame | null;
  facialHair: SpriteFrame | null;
  hair: SpriteFrame | null;
  equipment: SpriteFrame[];
};

type Outfit = {
  clothing: SpriteFrame;
  pants: SpriteFrame;
};

/** Plain clothes by group slot so nobody is drawn bare. */
const OUTFITS: Outfit[] = [
  { clothing: { col: 6, row: 0 }, pants: { col: 3, row: 5 } },
  { clothing: { col: 10, row: 0 }, pants: { col: 3, row: 6 } },
  { clothing: { col: 14, row: 0 }, pants: { col: 3, row: 7 } },
];

export const ENEMY_APPEARANCE: CharacterAppearance = {
  body: { col: 0, row: 3 },
  clothing: null,
  pants: null,
  facialHair: null,
  hair: null,
  equipment: [],
};

/** Held-item sprites by gear kind. Worn kinds (chest, pants, jewelry, tome) draw nothing. */
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

const KENNEY_BODY: Record<Skin, SpriteFrame> = {
  light: { col: 0, row: 0 },
  mid: { col: 0, row: 1 },
  dark: { col: 0, row: 2 },
};

/** Top-left of each 4x4 Kenney hair block. */
const KENNEY_HAIR_BLOCK: Record<HairColor, SpriteFrame> = {
  brown: { col: 19, row: 0 },
  ginger: { col: 23, row: 0 },
  blonde: { col: 19, row: 4 },
  black: { col: 23, row: 4 },
  ash: { col: 19, row: 8 },
};

/** Offset inside a hair block; the beard styles use Kenney hair with the beard drawn in. */
const KENNEY_HAIR: Record<HairStyle, SpriteFrame> = {
  sweep: { col: 0, row: 0 },
  long: { col: 1, row: 0 },
  bob: { col: 2, row: 2 },
  cropBeard: { col: 0, row: 2 },
  sweepBeard: { col: 3, row: 0 },
};

function equipmentFrames(member: GroupMember): SpriteFrame[] {
  const held = [member.equipment.mainHand, member.equipment.offHand];
  return held.flatMap((item) => {
    const frame = item ? HELD_FRAMES[item.kind] : undefined;
    return frame ? [frame] : [];
  });
}

export function getMemberAppearance(member: GroupMember, index: number): CharacterAppearance {
  const block = KENNEY_HAIR_BLOCK[member.look.hairColor];
  const style = KENNEY_HAIR[member.look.hairStyle];
  return {
    body: KENNEY_BODY[member.look.skin],
    hair: { col: block.col + style.col, row: block.row + style.row },
    facialHair: null,
    ...OUTFITS[index % OUTFITS.length]!,
    equipment: equipmentFrames(member),
  };
}

export function appearanceFrames(appearance: CharacterAppearance): SpriteFrame[] {
  const layers = [
    appearance.body,
    appearance.pants,
    appearance.clothing,
    appearance.facialHair,
    appearance.hair,
  ];
  return [...layers.filter((frame): frame is SpriteFrame => frame !== null), ...appearance.equipment];
}
