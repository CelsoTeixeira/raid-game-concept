import { CARDINALS, type GridPoint } from "./grid";
import { findPath, inBounds } from "./path";

export const DUNGEON_COLS = 64;
export const DUNGEON_ROWS = 40;

export type TileKind = "wall" | "room" | "corridor";
export type RoomSize = "small" | "medium" | "big" | "boss";
export type DungeonRect = { c: number; r: number; w: number; h: number; size: RoomSize };
export type BossSide = "east" | "west" | "south" | "north";

export type Dungeon = {
  seed: number;
  cols: number;
  rows: number;
  blocked: boolean[][];
  kind: TileKind[][];
  rooms: DungeonRect[];
  boss: DungeonRect;
  /** Small room with no packs; `start` is its center, where the portal sits. */
  entry: DungeonRect;
  start: GridPoint;
  end: GridPoint;
  path: GridPoint[];
};

type Rng = () => number;

const ATTEMPTS = 48;
const BOSS_BAND = 0.58;
const ENTRY_BAND = 0.3;
const BOSS_SIDES: BossSide[] = ["east", "west", "south", "north"];

const ROOM_SPECS: Record<RoomSize, { minW: number; maxW: number; minH: number; maxH: number }> = {
  small: { minW: 8, maxW: 9, minH: 8, maxH: 9 },
  medium: { minW: 11, maxW: 13, minH: 9, maxH: 11 },
  big: { minW: 13, maxW: 16, minH: 11, maxH: 13 },
  boss: { minW: 14, maxW: 16, minH: 12, maxH: 14 },
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
): void {
  carveCell(dungeon, c, r, as);
  carveCell(dungeon, c + 1, r, as);
  carveCell(dungeon, c, r + 1, as);
  carveCell(dungeon, c + 1, r + 1, as);
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
): void {
  let c = a.c;
  let r = a.r;
  carveBrush(dungeon, c, r, "corridor");
  while (c !== b.c || r !== b.r) {
    if (c !== b.c) c += Math.sign(b.c - c);
    else r += Math.sign(b.r - r);
    carveBrush(dungeon, c, r, "corridor");
  }
}

function carveL(
  dungeon: Pick<Dungeon, "blocked" | "kind" | "cols" | "rows">,
  a: GridPoint,
  b: GridPoint,
  rng: Rng,
): void {
  const corner: GridPoint = rng() < 0.5 ? { c: b.c, r: a.r } : { c: a.c, r: b.r };
  carveLine(dungeon, a, corner);
  carveLine(dungeon, corner, b);
}

/** Vertical leg first so the 2-wide corridor meets the boss west face head-on as a 2-tile door. */
function carveGate(
  dungeon: Pick<Dungeon, "blocked" | "kind" | "cols" | "rows">,
  from: GridPoint,
  boss: DungeonRect,
): void {
  const target = roomCenter(boss);
  const corner: GridPoint = { c: from.c, r: target.r };
  carveLine(dungeon, from, corner);
  carveLine(dungeon, corner, target);
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
  entry: DungeonRect,
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
    carveL(dungeon, centers[edge.a], centers[edge.b], rng);
  }
  const extraCount = Math.min(extra.length, randInt(rng, 1, 3));
  for (let i = 0; i < extraCount; i++) {
    const pick = extra.splice(randInt(rng, 0, extra.length - 1), 1)[0];
    if (!pick) break;
    carveL(dungeon, centers[pick.a], centers[pick.b], rng);
  }
  if (!boss || others.length === 0) return;
  let gate = others.find((room) => room !== entry) ?? entry;
  let best = Infinity;
  const target = roomCenter(boss);
  for (const room of others) {
    if (room === entry) continue;
    const p = roomCenter(room);
    const d = Math.abs(p.c - target.c) + Math.abs(p.r - target.r);
    if (d < best) {
      best = d;
      gate = room;
    }
  }
  carveGate(dungeon, roomCenter(gate), boss);
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

function placeRooms(rng: Rng, cols: number, rows: number): { rooms: DungeonRect[]; entry: DungeonRect } | null {
  const rooms: DungeonRect[] = [];
  const boss = tryPlace(rng, "boss", cols, rows, rooms, Math.floor(cols * BOSS_BAND), cols - 1);
  if (!boss) return null;
  rooms.push(boss);
  const entry = tryPlace(rng, "small", cols, rows, rooms, 1, Math.floor(cols * ENTRY_BAND));
  if (!entry) return null;
  rooms.push(entry);

  const bag: RoomSize[] = ["small", "small", "medium", "medium", "big"];
  if (rng() < 0.55) bag.push("small");
  if (rng() < 0.45) bag.push("big");

  for (const size of shuffle(rng, bag)) {
    const next = tryPlace(rng, size, cols, rows, rooms, 1, boss.c - 1);
    if (next) rooms.push(next);
  }

  const has = (size: RoomSize) => rooms.some((room) => room !== entry && room.size === size);
  if (!has("small") || !has("medium") || !has("big")) return null;
  return { rooms, entry };
}

function finishDungeon(
  seed: number,
  cols: number,
  rows: number,
  blocked: boolean[][],
  kind: TileKind[][],
  rooms: DungeonRect[],
  entry: DungeonRect,
): Dungeon | null {
  const boss = rooms.find((room) => room.size === "boss");
  const others = rooms.filter((room) => room.size !== "boss");
  if (!boss || others.length < 3) return null;
  const start = roomCenter(entry);
  const end = roomCenter(boss);
  if (start.c === end.c && start.r === end.r) return null;
  if (blocked[start.r][start.c] || blocked[end.r][end.c]) return null;
  const steps = findPath(blocked, start, end);
  if (steps.length === 0) return null;
  const built: Dungeon = { seed, cols, rows, blocked, kind, rooms, boss, entry, start, end, path: [start, ...steps] };
  if (tilesTouchingBoss(built, boss).length > 2) return null;
  return built;
}

/** Maps a dungeon built with the boss on the east edge onto `side`. North/south transpose it into a portrait grid. */
function orient(d: Dungeon, side: BossSide): Dungeon {
  if (side === "east") return d;
  const along = d.cols;
  const point = (p: GridPoint): GridPoint => {
    if (side === "west") return { c: along - 1 - p.c, r: p.r };
    if (side === "south") return { c: p.r, r: p.c };
    return { c: p.r, r: along - 1 - p.c };
  };
  const rect = (room: DungeonRect): DungeonRect => {
    if (side === "west") return { ...room, c: along - room.c - room.w };
    if (side === "south") return { c: room.r, r: room.c, w: room.h, h: room.w, size: room.size };
    return { c: room.r, r: along - room.c - room.w, w: room.h, h: room.w, size: room.size };
  };
  const cols = side === "west" ? d.cols : d.rows;
  const rows = side === "west" ? d.rows : d.cols;
  const { blocked, kind } = emptyGrid(cols, rows);
  for (let r = 0; r < d.rows; r++) {
    for (let c = 0; c < d.cols; c++) {
      const p = point({ c, r });
      blocked[p.r][p.c] = d.blocked[r][c];
      kind[p.r][p.c] = d.kind[r][c];
    }
  }
  const rooms = d.rooms.map(rect);
  return {
    ...d,
    cols,
    rows,
    blocked,
    kind,
    rooms,
    boss: rooms[d.rooms.indexOf(d.boss)],
    entry: rooms[d.rooms.indexOf(d.entry)],
    start: point(d.start),
    end: point(d.end),
    path: d.path.map(point),
  };
}

function tryGenerate(seed: number): Dungeon | null {
  const rng = mulberry32(seed);
  const side = BOSS_SIDES[Math.floor(rng() * BOSS_SIDES.length)];
  const cols = DUNGEON_COLS;
  const rows = DUNGEON_ROWS;
  const { blocked, kind } = emptyGrid(cols, rows);
  const placed = placeRooms(rng, cols, rows);
  if (!placed) return null;
  const draft = { blocked, kind, cols, rows };
  for (const room of placed.rooms) carveRoom(draft, room);
  connectRooms(draft, placed.rooms, placed.entry, rng);
  const built = finishDungeon(seed, cols, rows, blocked, kind, placed.rooms, placed.entry);
  return built && orient(built, side);
}

/** Entry, medium, big, then the boss on the east or west side. Always walkable if random placement fails. */
function fallbackDungeon(seed: number): Dungeon {
  const cols = DUNGEON_COLS;
  const rows = DUNGEON_ROWS;
  const { blocked, kind } = emptyGrid(cols, rows);
  const rooms: DungeonRect[] = [
    { c: 2, r: 16, w: 8, h: 8, size: "small" },
    { c: 14, r: 8, w: 12, h: 10, size: "medium" },
    { c: 30, r: 14, w: 14, h: 12, size: "big" },
    { c: 47, r: 13, w: 15, h: 13, size: "boss" },
  ];
  const draft = { blocked, kind, cols, rows };
  for (const room of rooms) carveRoom(draft, room);
  carveL(draft, roomCenter(rooms[0]), roomCenter(rooms[1]), () => 0.2);
  carveL(draft, roomCenter(rooms[1]), roomCenter(rooms[2]), () => 0.8);
  carveGate(draft, roomCenter(rooms[2]), rooms[3]);
  const built = finishDungeon(seed, cols, rows, blocked, kind, rooms, rooms[0]);
  if (!built) throw new Error("fallback dungeon must be walkable");
  return orient(built, seed & 1 ? "west" : "east");
}

/** Room-and-corridor map with the boss on a random side and a verified walk from the entry portal into it. */
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
