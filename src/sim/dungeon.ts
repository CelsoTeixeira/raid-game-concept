import { CARDINALS, type GridPoint } from "./grid";
import { findPath, inBounds } from "./path";

export const DUNGEON_COLS = 48;
export const DUNGEON_ROWS = 28;

export type TileKind = "wall" | "room" | "corridor";
export type RoomSize = "small" | "medium" | "big" | "boss";
export type DungeonRect = { c: number; r: number; w: number; h: number; size: RoomSize };

export type Dungeon = {
  seed: number;
  cols: number;
  rows: number;
  blocked: boolean[][];
  kind: TileKind[][];
  rooms: DungeonRect[];
  boss: DungeonRect;
  start: GridPoint;
  end: GridPoint;
  path: GridPoint[];
};

type Rng = () => number;

const ATTEMPTS = 36;
const BOSS_BAND = 0.58;

const ROOM_SPECS: Record<RoomSize, { minW: number; maxW: number; minH: number; maxH: number }> = {
  small: { minW: 4, maxW: 5, minH: 4, maxH: 5 },
  medium: { minW: 6, maxW: 8, minH: 5, maxH: 7 },
  big: { minW: 8, maxW: 10, minH: 7, maxH: 9 },
  boss: { minW: 10, maxW: 12, minH: 8, maxH: 10 },
};

/** Deterministic 0..1 generator so a seed can be replayed from the HUD. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomDungeonSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

export function roomCenter(room: DungeonRect): GridPoint {
  return { c: room.c + Math.floor(room.w / 2), r: room.r + Math.floor(room.h / 2) };
}

export function roomContaining(dungeon: Dungeon, c: number, r: number): DungeonRect | undefined {
  return dungeon.rooms.find(
    (room) => c >= room.c && c < room.c + room.w && r >= room.r && r < room.r + room.h,
  );
}

function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function roomsOverlap(a: DungeonRect, b: DungeonRect, pad: number): boolean {
  return (
    a.c < b.c + b.w + pad &&
    a.c + a.w + pad > b.c &&
    a.r < b.r + b.h + pad &&
    a.r + a.h + pad > b.r
  );
}

function emptyGrid(cols: number, rows: number): { blocked: boolean[][]; kind: TileKind[][] } {
  const blocked = Array.from({ length: rows }, () => Array(cols).fill(true));
  const kind = Array.from({ length: rows }, () => Array<TileKind>(cols).fill("wall"));
  return { blocked, kind };
}

function carveCell(dungeon: Pick<Dungeon, "blocked" | "kind" | "cols" | "rows">, c: number, r: number, as: TileKind): void {
  if (!inBounds(c, r, dungeon.cols, dungeon.rows)) return;
  if (c <= 0 || r <= 0 || c >= dungeon.cols - 1 || r >= dungeon.rows - 1) return;
  dungeon.blocked[r][c] = false;
  if (as === "room" || dungeon.kind[r][c] === "wall") dungeon.kind[r][c] = as;
}

function insideRoom(room: DungeonRect, c: number, r: number): boolean {
  return c >= room.c && c < room.c + room.w && r >= room.r && r < room.r + room.h;
}

/** 2x2 brush so corridors stay wide enough for a pack. */
function carveBrush(
  dungeon: Pick<Dungeon, "blocked" | "kind" | "cols" | "rows">,
  c: number,
  r: number,
  as: TileKind,
  avoid?: DungeonRect,
): void {
  const paint = (cc: number, rr: number) => {
    if (avoid && insideRoom(avoid, cc, rr)) return;
    carveCell(dungeon, cc, rr, as);
  };
  paint(c, r);
  paint(c + 1, r);
  paint(c, r + 1);
  paint(c + 1, r + 1);
}

function carveRoom(dungeon: Pick<Dungeon, "blocked" | "kind" | "cols" | "rows">, room: DungeonRect): void {
  for (let r = room.r; r < room.r + room.h; r++) {
    for (let c = room.c; c < room.c + room.w; c++) {
      carveCell(dungeon, c, r, "room");
    }
  }
}

function carveLine(
  dungeon: Pick<Dungeon, "blocked" | "kind" | "cols" | "rows">,
  a: GridPoint,
  b: GridPoint,
  avoid?: DungeonRect,
): void {
  let c = a.c;
  let r = a.r;
  carveBrush(dungeon, c, r, "corridor", avoid);
  while (c !== b.c || r !== b.r) {
    if (c !== b.c) c += Math.sign(b.c - c);
    else r += Math.sign(b.r - r);
    carveBrush(dungeon, c, r, "corridor", avoid);
  }
}

function carveL(
  dungeon: Pick<Dungeon, "blocked" | "kind" | "cols" | "rows">,
  a: GridPoint,
  b: GridPoint,
  rng: Rng,
  avoid?: DungeonRect,
): void {
  const corner: GridPoint = rng() < 0.5 ? { c: b.c, r: a.r } : { c: a.c, r: b.r };
  carveLine(dungeon, a, corner, avoid);
  carveLine(dungeon, corner, b, avoid);
}

function findRoot(parent: number[], i: number): number {
  let cur = i;
  while (parent[cur] !== cur) {
    parent[cur] = parent[parent[cur]];
    cur = parent[cur];
  }
  return cur;
}

function connectRooms(
  dungeon: Pick<Dungeon, "blocked" | "kind" | "cols" | "rows">,
  rooms: DungeonRect[],
  rng: Rng,
): void {
  const others = rooms.filter((room) => room.size !== "boss");
  const boss = rooms.find((room) => room.size === "boss");
  const centers = others.map(roomCenter);
  const parent = others.map((_, i) => i);
  const edges: Array<{ a: number; b: number; d: number }> = [];
  for (let i = 0; i < others.length; i++) {
    for (let j = i + 1; j < others.length; j++) {
      const d = Math.abs(centers[i].c - centers[j].c) + Math.abs(centers[i].r - centers[j].r);
      edges.push({ a: i, b: j, d });
    }
  }
  edges.sort((x, y) => x.d - y.d);
  const extra: typeof edges = [];
  for (const edge of edges) {
    const ra = findRoot(parent, edge.a);
    const rb = findRoot(parent, edge.b);
    if (ra === rb) {
      extra.push(edge);
      continue;
    }
    parent[rb] = ra;
    carveL(dungeon, centers[edge.a], centers[edge.b], rng, boss);
  }
  const extraCount = Math.min(extra.length, randInt(rng, 1, 3));
  for (let i = 0; i < extraCount; i++) {
    const pick = extra.splice(randInt(rng, 0, extra.length - 1), 1)[0];
    if (!pick) break;
    carveL(dungeon, centers[pick.a], centers[pick.b], rng, boss);
  }
  if (!boss || others.length === 0) return;
  sealBossPerimeter(dungeon, boss);
  let gate = others[0];
  let best = Infinity;
  const target = roomCenter(boss);
  for (const room of others) {
    const p = roomCenter(room);
    const d = Math.abs(p.c - target.c) + Math.abs(p.r - target.r);
    if (d < best) {
      best = d;
      gate = room;
    }
  }
  carveL(dungeon, roomCenter(gate), target, rng);
}

function tilesTouchingBoss(
  dungeon: Pick<Dungeon, "blocked" | "cols" | "rows">,
  boss: DungeonRect,
): GridPoint[] {
  const seen = new Set<string>();
  const out: GridPoint[] = [];
  for (let r = boss.r; r < boss.r + boss.h; r++) {
    for (let c = boss.c; c < boss.c + boss.w; c++) {
      if (dungeon.blocked[r][c]) continue;
      for (const [dc, dr] of CARDINALS) {
        const nc = c + dc;
        const nr = r + dr;
        if (!inBounds(nc, nr, dungeon.cols, dungeon.rows)) continue;
        if (insideRoom(boss, nc, nr) || dungeon.blocked[nr][nc]) continue;
        const k = `${nc},${nr}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ c: nc, r: nr });
      }
    }
  }
  return out;
}

function sealBossPerimeter(
  dungeon: Pick<Dungeon, "blocked" | "kind" | "cols" | "rows">,
  boss: DungeonRect,
): void {
  for (const tile of tilesTouchingBoss(dungeon, boss)) {
    dungeon.blocked[tile.r][tile.c] = true;
    dungeon.kind[tile.r][tile.c] = "wall";
  }
}

/** Walkable tiles just outside the boss, grouped into doorways. */
export function countBossEntrances(dungeon: Dungeon): number {
  const touches = tilesTouchingBoss(dungeon, dungeon.boss);
  const keys = new Set(touches.map((p) => `${p.c},${p.r}`));
  const seen = new Set<string>();
  let groups = 0;
  for (const tile of touches) {
    const start = `${tile.c},${tile.r}`;
    if (seen.has(start)) continue;
    groups += 1;
    const q: GridPoint[] = [tile];
    seen.add(start);
    while (q.length > 0) {
      const cur = q.shift()!;
      for (const [dc, dr] of CARDINALS) {
        const nk = `${cur.c + dc},${cur.r + dr}`;
        if (!keys.has(nk) || seen.has(nk)) continue;
        seen.add(nk);
        q.push({ c: cur.c + dc, r: cur.r + dr });
      }
    }
  }
  return groups;
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function tryPlace(
  rng: Rng,
  size: RoomSize,
  cols: number,
  rows: number,
  existing: DungeonRect[],
  cMin: number,
  cLimit: number,
): DungeonRect | null {
  const spec = ROOM_SPECS[size];
  for (let n = 0; n < 48; n++) {
    const w = randInt(rng, spec.minW, spec.maxW);
    const h = randInt(rng, spec.minH, spec.maxH);
    const cHi = Math.min(cols - 2 - w, cLimit - w);
    const rHi = rows - 2 - h;
    if (cHi < cMin || rHi < 1) continue;
    const next: DungeonRect = {
      c: randInt(rng, cMin, cHi),
      r: randInt(rng, 1, rHi),
      w,
      h,
      size,
    };
    if (existing.some((room) => roomsOverlap(room, next, 1))) continue;
    return next;
  }
  return null;
}

function placeRooms(rng: Rng, cols: number, rows: number): DungeonRect[] | null {
  const rooms: DungeonRect[] = [];
  const boss = tryPlace(rng, "boss", cols, rows, rooms, Math.floor(cols * BOSS_BAND), cols - 1);
  if (!boss) return null;
  rooms.push(boss);

  const bag: RoomSize[] = ["small", "small", "medium", "medium", "big"];
  if (rng() < 0.55) bag.push("small");
  if (rng() < 0.45) bag.push("big");

  for (const size of shuffle(rng, bag)) {
    const next = tryPlace(rng, size, cols, rows, rooms, 1, boss.c - 1);
    if (next) rooms.push(next);
  }

  const has = (size: RoomSize) => rooms.some((room) => room.size === size);
  if (!has("small") || !has("medium") || !has("big")) return null;
  return rooms;
}

function finishDungeon(
  seed: number,
  cols: number,
  rows: number,
  blocked: boolean[][],
  kind: TileKind[][],
  rooms: DungeonRect[],
): Dungeon | null {
  const boss = rooms.find((room) => room.size === "boss");
  const others = rooms.filter((room) => room.size !== "boss");
  if (!boss || others.length < 3) return null;
  const startRoom = [...others].sort((a, b) => roomCenter(a).c - roomCenter(b).c)[0];
  const start = roomCenter(startRoom);
  const end = roomCenter(boss);
  if (start.c === end.c && start.r === end.r) return null;
  if (blocked[start.r][start.c] || blocked[end.r][end.c]) return null;
  const steps = findPath(blocked, start, end);
  if (steps.length === 0) return null;
  const built: Dungeon = { seed, cols, rows, blocked, kind, rooms, boss, start, end, path: [start, ...steps] };
  if (countBossEntrances(built) !== 1) return null;
  return built;
}

function tryGenerate(seed: number): Dungeon | null {
  const rng = mulberry32(seed);
  const cols = DUNGEON_COLS;
  const rows = DUNGEON_ROWS;
  const { blocked, kind } = emptyGrid(cols, rows);
  const rooms = placeRooms(rng, cols, rows);
  if (!rooms) return null;
  const draft = { blocked, kind, cols, rows };
  for (const room of rooms) carveRoom(draft, room);
  connectRooms(draft, rooms, rng);
  return finishDungeon(seed, cols, rows, blocked, kind, rooms);
}

/** Small, medium, big, then a boss room on the east side. Always walkable if random placement fails. */
function fallbackDungeon(seed: number): Dungeon {
  const cols = DUNGEON_COLS;
  const rows = DUNGEON_ROWS;
  const { blocked, kind } = emptyGrid(cols, rows);
  const rooms: DungeonRect[] = [
    { c: 2, r: 11, w: 5, h: 5, size: "small" },
    { c: 10, r: 8, w: 7, h: 6, size: "medium" },
    { c: 20, r: 9, w: 9, h: 8, size: "big" },
    { c: 34, r: 9, w: 12, h: 10, size: "boss" },
  ];
  const draft = { blocked, kind, cols, rows };
  for (const room of rooms) carveRoom(draft, room);
  carveL(draft, roomCenter(rooms[0]), roomCenter(rooms[1]), () => 0.2, rooms[3]);
  carveL(draft, roomCenter(rooms[1]), roomCenter(rooms[2]), () => 0.8, rooms[3]);
  sealBossPerimeter(draft, rooms[3]);
  carveL(draft, roomCenter(rooms[2]), roomCenter(rooms[3]), () => 0.3);
  const built = finishDungeon(seed, cols, rows, blocked, kind, rooms);
  if (!built) throw new Error("fallback dungeon must be walkable");
  return built;
}

/** Room-and-corridor map with a verified walk from the westmost room into the boss chamber. */
export function generateDungeon(seed = randomDungeonSeed()): Dungeon {
  const base = seed >>> 0;
  for (let i = 0; i < ATTEMPTS; i++) {
    const built = tryGenerate((base + i * 9973) >>> 0);
    if (built) return built;
  }
  return fallbackDungeon(base);
}

export function isReservedTile(dungeon: Dungeon, c: number, r: number): boolean {
  return (c === dungeon.start.c && r === dungeon.start.r) || (c === dungeon.end.c && r === dungeon.end.r);
}

export function isFloorTile(dungeon: Dungeon, c: number, r: number): boolean {
  return inBounds(c, r, dungeon.cols, dungeon.rows) && !dungeon.blocked[r][c];
}

export function countRoomsBySize(rooms: DungeonRect[]): { small: number; medium: number; big: number } {
  return {
    small: rooms.filter((room) => room.size === "small").length,
    medium: rooms.filter((room) => room.size === "medium").length,
    big: rooms.filter((room) => room.size === "big").length,
  };
}
