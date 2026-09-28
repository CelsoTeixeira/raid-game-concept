import Phaser from "phaser";
import { TILE } from "../sim/balance";
import { gridCenter, type GridPoint } from "../sim/grid";

export function drawPortal(g: Phaser.GameObjects.Graphics, at: GridPoint): void {
  const { x, y } = gridCenter(at, TILE);
  g.fillStyle(0x7c3aed, 0.25);
  g.fillCircle(x, y, TILE * 0.95);
  g.fillStyle(0x1e1b4b, 1);
  g.fillCircle(x, y, TILE * 0.6);
  g.lineStyle(3, 0xa78bfa, 1);
  g.strokeCircle(x, y, TILE * 0.6);
  g.lineStyle(1, 0xc4b5fd, 0.8);
  g.strokeCircle(x, y, TILE * 0.35);
}
