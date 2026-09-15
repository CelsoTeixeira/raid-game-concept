export type GridPoint = { c: number; r: number };

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function tileKey(c: number, r: number): string {
  return `${c},${r}`;
}

/** Floor to a cell, clamped onto the map (clicks past the edge still land in-bounds). */
export function worldToGrid(x: number, y: number, tile: number, cols: number, rows: number): GridPoint {
  return {
    c: clamp(Math.floor(x / tile), 0, cols - 1),
    r: clamp(Math.floor(y / tile), 0, rows - 1),
  };
}

export function gridCenter(p: GridPoint, tile: number): { x: number; y: number } {
  return { x: p.c * tile + tile / 2, y: p.r * tile + tile / 2 };
}
