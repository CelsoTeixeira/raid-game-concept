import { COLS, ROWS, TILE } from "./balance";
import { worldToGrid, type GridPoint } from "./grid";
import { findPath, inBounds } from "./path";

export type WorldPoint = { x: number; y: number };

export function gridPathToWorld(path: GridPoint[], tile: number): WorldPoint[] {
  return path.map((p) => ({ x: p.c * tile + tile / 2, y: p.r * tile + tile / 2 }));
}

/** Sample the segment; walls fail. Units are not blockers. */
export function lineClear(
  blocked: boolean[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const span = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(span / (TILE / 4)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const g = worldToGrid(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, TILE, COLS, ROWS);
    if (!inBounds(g.c, g.r, COLS, ROWS) || blocked[g.r][g.c]) return false;
  }
  return true;
}

/**
 * Even ring around `origin` at `radius`. Drops slots that land in a wall.
 * Enemies stand here instead of snapping to tile centers.
 */
export function ringSlots(
  blocked: boolean[][],
  origin: WorldPoint,
  radius: number,
  count: number,
): WorldPoint[] {
  const n = Math.max(count, 1);
  const out: WorldPoint[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const p = { x: origin.x + Math.cos(a) * radius, y: origin.y + Math.sin(a) * radius };
    const g = worldToGrid(p.x, p.y, TILE, COLS, ROWS);
    if (!inBounds(g.c, g.r, COLS, ROWS) || blocked[g.r][g.c]) continue;
    out.push(p);
  }
  return out;
}

/** A* around walls, then the exact world slot as the last point. */
export function pathToPoint(
  blocked: boolean[][],
  from: WorldPoint,
  to: WorldPoint,
): WorldPoint[] {
  if (lineClear(blocked, from.x, from.y, to.x, to.y)) return [to];
  const start = worldToGrid(from.x, from.y, TILE, COLS, ROWS);
  const goal = worldToGrid(to.x, to.y, TILE, COLS, ROWS);
  const grid = findPath(blocked, start, goal);
  const world = gridPathToWorld(grid, TILE);
  if (world.length === 0) return lineClear(blocked, from.x, from.y, to.x, to.y) ? [to] : [];
  const last = world[world.length - 1];
  if (Math.hypot(last.x - to.x, last.y - to.y) > 2) world.push(to);
  else world[world.length - 1] = to;
  return world;
}
