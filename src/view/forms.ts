import Phaser from "phaser";
import type { RangeType, Role, Side } from "../sim/types";

export const FORM = {
  enemy: 0xcc3333,
  tank: 0x3b82f6,
  dps: 0xeab308,
  healer: 0x22c55e,
} as const;

/**
 * Placeholder forms. Tank triangle vertices are chosen so the centroid sits at (0,0)
 * (Phaser Triangle origin is not the visual center).
 */
export function makeForm(
  scene: Phaser.Scene,
  side: Side,
  role: Role,
  rangeType: RangeType,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  if (side === "enemy") {
    g.fillStyle(FORM.enemy);
    g.fillRect(-9, -9, 18, 18);
    return g;
  }
  if (role === "tank") {
    g.fillStyle(FORM.tank);
    g.fillTriangle(0, -12, 12, 6, -12, 6);
    return g;
  }
  if (role === "healer") {
    g.fillStyle(FORM.healer);
    g.fillCircle(0, 0, 10);
    return g;
  }
  g.fillStyle(FORM.dps);
  if (rangeType === "ranged") {
    g.fillCircle(0, 0, 10);
    return g;
  }
  g.fillTriangle(0, -11, 11, 0, 0, 11);
  g.fillTriangle(0, -11, -11, 0, 0, 11);
  return g;
}
