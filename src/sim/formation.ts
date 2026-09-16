import { TILE } from "./balance";
import { worldToGrid } from "./grid";
import type { WorldPoint } from "./nav";
import { inBounds } from "./path";
import type { SimUnit } from "./unit";

export const FORMATIONS = ["raid", "line", "box"] as const;
export type FormationKind = (typeof FORMATIONS)[number];

const GAP = 28;
const ROW = 34;

export type Facing = { fx: number; fy: number; rx: number; ry: number };

export function rankOf(u: SimUnit): 0 | 1 | 2 {
  if (u.role === "tank") return 0;
  if (u.rangeType === "melee") return 1;
  return 2;
}

/** Short tag on the move preview: tank / melee-dps / ranged-dps / healer. */
export function slotLabel(u: SimUnit): string {
  if (u.role === "tank") return "T";
  if (u.role === "healer") return u.rangeType === "ranged" ? "Hr" : "Hm";
  return u.rangeType === "ranged" ? "Dr" : "Dm";
}

export function facingFrom(from: WorldPoint, to: WorldPoint, fallback: Facing): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 8) return fallback;
  const fx = dx / len;
  const fy = dy / len;
  return { fx, fy, rx: -fy, ry: fx };
}

function row(n: number, origin: WorldPoint, face: Facing): WorldPoint[] {
  if (n <= 0) return [];
  const start = -((n - 1) * GAP) / 2;
  return Array.from({ length: n }, (_, i) => ({
    x: origin.x + face.rx * (start + i * GAP),
    y: origin.y + face.ry * (start + i * GAP),
  }));
}

function back(click: WorldPoint, face: Facing, rows: number): WorldPoint {
  return { x: click.x - face.fx * ROW * rows, y: click.y - face.fy * ROW * rows };
}

/** Slide the pack so its centroid sits on the click (mouse = formation center). */
function centerOn(slots: WorldPoint[], click: WorldPoint): WorldPoint[] {
  if (slots.length === 0) return slots;
  const cx = slots.reduce((s, p) => s + p.x, 0) / slots.length;
  const cy = slots.reduce((s, p) => s + p.y, 0) / slots.length;
  return slots.map((p) => ({ x: p.x + click.x - cx, y: p.y + click.y - cy }));
}

/**
 * Click is the centroid of the pack. Tanks stay toward facing, ranged behind.
 * Empty raid ranks collapse so a solo unit lands on the click.
 */
export function layoutSlots(
  kind: FormationKind,
  click: WorldPoint,
  face: Facing,
  tanks: number,
  melee: number,
  ranged: number,
): WorldPoint[] {
  let slots: WorldPoint[];
  if (kind === "line") {
    slots = row(tanks + melee + ranged, click, face);
  } else if (kind === "box") {
    const ordered = tanks + melee + ranged;
    slots = [];
    const width = 3;
    let left = ordered;
    let r = 0;
    while (left > 0) {
      const n = Math.min(width, left);
      slots.push(...row(n, back(click, face, r), face));
      left -= n;
      r += 1;
    }
  } else {
    const ranks = [tanks, melee, ranged].filter((n) => n > 0);
    slots = ranks.flatMap((n, i) => row(n, back(click, face, i), face));
  }
  return centerOn(slots, click);
}

export function snapWalkable(blocked: boolean[][], p: WorldPoint): WorldPoint {
  const rows = blocked.length;
  const cols = blocked[0]?.length ?? 0;
  const g = worldToGrid(p.x, p.y, TILE, cols, rows);
  if (inBounds(g.c, g.r, cols, rows) && !blocked[g.r][g.c]) return p;
  let best: WorldPoint | null = null;
  let bestD = 1e9;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (blocked[r][c]) continue;
      const x = c * TILE + TILE / 2;
      const y = r * TILE + TILE / 2;
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best ?? p;
}

export function nextFormation(kind: FormationKind): FormationKind {
  const i = FORMATIONS.indexOf(kind);
  return FORMATIONS[(i + 1) % FORMATIONS.length];
}
