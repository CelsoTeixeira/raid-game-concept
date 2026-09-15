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
  equipmentRow: number;
};

const APPEARANCE_VARIANTS: AppearanceVariant[] = [
  {
    body: { col: 0, row: 0 },
    clothing: { col: 6, row: 0 },
    pants: { col: 3, row: 5 },
    equipmentRow: 0,
  },
  {
    body: { col: 0, row: 1 },
    clothing: { col: 10, row: 0 },
    pants: { col: 3, row: 6 },
    equipmentRow: 1,
  },
  {
    body: { col: 0, row: 2 },
    clothing: { col: 14, row: 0 },
    pants: { col: 3, row: 7 },
    equipmentRow: 2,
  },
];

export const ENEMY_APPEARANCE: CharacterAppearance = {
  body: { col: 0, row: 3 },
  clothing: null,
  pants: null,
  equipment: [],
};

function equipmentFrames(member: GroupMember, row: number): SpriteFrame[] {
  if (member.role === "tank") {
    return [
      { col: 44, row: 6 },
      { col: 37, row: 0 },
    ];
  }
  if (member.role === "healer") {
    return [{ col: 46, row }];
  }
  if (member.rangeType === "ranged") {
    return [{ col: row === 1 ? 46 : 52, row }];
  }
  return [row === 0 ? { col: 44, row: 6 } : { col: row === 1 ? 50 : 47, row: 0 }];
}

export function getMemberAppearance(member: GroupMember, index: number): CharacterAppearance {
  const variant = APPEARANCE_VARIANTS[index % APPEARANCE_VARIANTS.length];
  return {
    body: variant.body,
    clothing: variant.clothing,
    pants: variant.pants,
    equipment: equipmentFrames(member, variant.equipmentRow),
  };
}

export function appearanceFrames(appearance: CharacterAppearance): SpriteFrame[] {
  const frames = [appearance.body];
  if (appearance.pants) frames.push(appearance.pants);
  if (appearance.clothing) frames.push(appearance.clothing);
  return [...frames, ...appearance.equipment];
}
