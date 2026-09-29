/** Kenney 16px sheet frames used by enemies in Phaser scenes. */
export type SpriteFrame = { col: number; row: number };

export type CharacterAppearance = {
  body: SpriteFrame;
  clothing: SpriteFrame | null;
  pants: SpriteFrame | null;
  facialHair: SpriteFrame | null;
  hair: SpriteFrame | null;
  equipment: SpriteFrame[];
};

export const ENEMY_APPEARANCE: CharacterAppearance = {
  body: { col: 0, row: 3 },
  clothing: null,
  pants: null,
  facialHair: null,
  hair: null,
  equipment: [],
};

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
