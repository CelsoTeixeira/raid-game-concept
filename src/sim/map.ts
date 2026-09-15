import { COLS, ROWS } from "./balance";

/** Static walls as `[c, r, w, h]` in tiles. Shared by sim occupancy and the Phaser field. */
export const WALLS: Array<[number, number, number, number]> = [
  [8, 4, 3, 2],
  [14, 10, 4, 2],
  [20, 5, 2, 4],
];

export function createBlocked(): boolean[][] {
  const blocked = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  for (const [c, r, w, h] of WALLS) {
    for (let y = r; y < r + h; y++) {
      for (let x = c; x < c + w; x++) {
        blocked[y][x] = true;
      }
    }
  }
  return blocked;
}
