import type { GearKindId } from "./sim/gearKinds";
import type { GroupMember } from "./sim/group";

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
