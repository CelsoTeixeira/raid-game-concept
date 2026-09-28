import Phaser from "phaser";
import { TILE } from "../sim/balance";
import { gridCenter, type GridPoint } from "../sim/grid";

const PORTAL_COLORS = {
  entry: { glow: 0x7c3aed, core: 0x1e1b4b, ring: 0xa78bfa, inner: 0xc4b5fd },
  exit: { glow: 0x0d9488, core: 0x042f2e, ring: 0x2dd4bf, inner: 0x99f6e4 },
};

export function drawPortal(g: Phaser.GameObjects.Graphics, at: GridPoint, kind: keyof typeof PORTAL_COLORS): void {
  const { x, y } = gridCenter(at, TILE);
  const color = PORTAL_COLORS[kind];
  g.fillStyle(color.glow, 0.25);
  g.fillCircle(x, y, TILE * 0.95);
  g.fillStyle(color.core, 1);
  g.fillCircle(x, y, TILE * 0.6);
  g.lineStyle(3, color.ring, 1);
  g.strokeCircle(x, y, TILE * 0.6);
  g.lineStyle(1, color.inner, 0.8);
  g.strokeCircle(x, y, TILE * 0.35);
}
