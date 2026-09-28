import { ENEMY_APPEARANCE } from "../appearance";
import { ENEMY_ENGAGE_RANGE, ENEMY_GROUP_SEPARATION, TILE } from "./balance";
import { living } from "./combat";
import {
  countRoomsBySize,
  generateDungeon,
  isFloorTile,
  isReservedTile,
  mulberry32,
  randomDungeonSeed,
  type ContentSize,
  type DungeonRect,
  type Dungeon,
  type GoalKind,
  type MapSize,
} from "./dungeon";
import { gridCenter, tileKey, worldToGrid, type GridPoint } from "./grid";
import { nearestOpen } from "./path";
import { enemyStats } from "./stats";
import type { SimUnit } from "./unit";

export type EnemyGroup = {
  id: string;
  anchor: GridPoint;
  unitIds: string[];
};

export type DungeonEncounterGroup = {
  id: string;
  anchor: GridPoint;
  positions: GridPoint[];
};

export type DungeonEncounter = {
  dungeon: Dungeon;
  groups: DungeonEncounterGroup[];
};

export type DungeonHudState = {
  seed: number;
  mapSize: MapSize;
  goal: GoalKind;
  rooms: number;
  smallRooms: number;
  mediumRooms: number;
  bigRooms: number;
  pathLength: number;
  packSize: number;
  groupCount: number;
  enemyAlive: number;
};

const PACK_SIZES = [2, 3, 4, 5] as const;
const GENERATED_PACKS: Record<ContentSize, readonly number[]> = {
  small: [3, 2],
  medium: [4, 3, 3],
  big: [4, 4, 4, 3],
};
const PARTY_SPAWN_GUARD = ENEMY_ENGAGE_RANGE + TILE * 2;

/**
 * Dungeon sandbox: walls from {@link generateDungeon}, with several seeded enemy packs in each
 * ordinary room except the entry and goal rooms. Packs sit farther apart than social range, across
 * rooms too, and outside engage range of the party spawn.
 * No friendlies — packs idle in place.
 */
export class DungeonWorld {
  dungeon: Dungeon;
  units: SimUnit[] = [];
  groups: EnemyGroup[] = [];
  packSize = 3;
  mapSize: MapSize = "medium";
  private nextUnit = 1;
  private nextGroup = 1;

  constructor(encounter?: DungeonEncounter | number) {
    if (typeof encounter === "object") {
      this.dungeon = encounter.dungeon;
      this.mapSize = encounter.dungeon.mapSize;
      this.restoreGroups(encounter.groups);
      return;
    }

    this.dungeon = generateDungeon(encounter ?? randomDungeonSeed(), this.mapSize);
    this.populateGeneratedPacks();
  }

  regenerate(seed?: number): void {
    this.units = [];
    this.groups = [];
    this.nextUnit = 1;
    this.nextGroup = 1;
    this.dungeon = generateDungeon(seed ?? randomDungeonSeed(), this.mapSize);
    this.populateGeneratedPacks();
  }

  setMapSize(size: MapSize): void {
    this.mapSize = size;
    this.regenerate();
  }

  setPackSize(size: number): void {
    if ((PACK_SIZES as readonly number[]).includes(size)) this.packSize = size;
  }

  previewTiles(x: number, y: number): GridPoint[] {
    const from = this.clickTile(x, y);
    if (!from) return [];
    return this.pickTiles(from, this.packSize);
  }

  placeGroup(x: number, y: number): EnemyGroup | null {
    const from = this.clickTile(x, y);
    if (!from) return null;
    const spots = this.pickTiles(from, this.packSize);
    if (spots.length === 0) return null;
    return this.addGroup(from, spots);
  }

  removeGroupAt(x: number, y: number): boolean {
    const hit = this.groupAt(x, y);
    if (!hit) return false;
    const ids = new Set(hit.unitIds);
    this.units = this.units.filter((u) => !ids.has(u.id));
    this.groups = this.groups.filter((g) => g.id !== hit.id);
    return true;
  }

  clearGroups(): void {
    this.units = [];
    this.groups = [];
  }

  encounter(): DungeonEncounter {
    const units = new Map(this.units.map((unit) => [unit.id, unit]));
    return {
      dungeon: this.dungeon,
      groups: this.groups.map((group) => ({
        id: group.id,
        anchor: { ...group.anchor },
        positions: group.unitIds
          .map((id) => units.get(id))
          .filter((unit): unit is SimUnit => !!unit && unit.stats.health > 0)
          .map((unit) => worldToGrid(unit.x, unit.y, TILE, this.dungeon.cols, this.dungeon.rows)),
      })),
    };
  }

  hud(): DungeonHudState {
    const sizes = countRoomsBySize(this.dungeon.rooms);
    return {
      seed: this.dungeon.seed,
      mapSize: this.dungeon.mapSize,
      goal: this.dungeon.goal.size === "boss" ? "boss" : "exit",
      rooms: this.dungeon.rooms.length,
      smallRooms: sizes.small,
      mediumRooms: sizes.medium,
      bigRooms: sizes.big,
      pathLength: this.dungeon.path.length,
      packSize: this.packSize,
      groupCount: this.groups.length,
      enemyAlive: living(this.units, "enemy").length,
    };
  }

  private clickTile(x: number, y: number): GridPoint | null {
    const g = worldToGrid(x, y, TILE, this.dungeon.cols, this.dungeon.rows);
    if (!isFloorTile(this.dungeon, g.c, g.r)) return null;
    if (isReservedTile(this.dungeon, g.c, g.r)) return null;
    if (this.taken().has(tileKey(g.c, g.r))) return null;
    return g;
  }

  private pickTiles(from: GridPoint, count: number): GridPoint[] {
    const taken = this.taken();
    const blocked = this.dungeon.blocked;
    const reserved = (c: number, r: number) =>
      taken.has(tileKey(c, r)) || isReservedTile(this.dungeon, c, r);
    const out: GridPoint[] = [];
    for (let i = 0; i < count; i++) {
      const spot = nearestOpen(blocked, from, reserved);
      if (!spot) break;
      taken.add(tileKey(spot.c, spot.r));
      out.push(spot);
    }
    return out;
  }

  private populateGeneratedPacks(): void {
    const rng = mulberry32(this.dungeon.seed);
    for (const room of this.dungeon.rooms) {
      if (room.size === "boss" || room.size === "exit" || room === this.dungeon.entry) continue;
      for (const packSize of GENERATED_PACKS[room.size]) {
        const spots = this.pickRoomTiles(room, packSize, rng);
        if (spots.length === packSize) this.addGroup(spots[0], spots);
      }
    }
  }

  private restoreGroups(groups: DungeonEncounterGroup[]): void {
    for (const group of groups) {
      const positions = group.positions.map((position) => ({ ...position }));
      if (positions.length === 0) continue;
      const unitIds = positions.map((position) => this.addEnemy(position));
      this.groups.push({ id: group.id, anchor: { ...group.anchor }, unitIds });
    }
    this.nextGroup = groups.reduce((next, group) => {
      const number = Number(group.id.replace("pack-", ""));
      return Number.isFinite(number) ? Math.max(next, number + 1) : next;
    }, 1);
  }

  private pickRoomTiles(room: DungeonRect, count: number, rng: () => number): GridPoint[] {
    const candidates: GridPoint[] = [];
    for (let r = room.r; r < room.r + room.h; r++) {
      for (let c = room.c; c < room.c + room.w; c++) {
        if (!isFloorTile(this.dungeon, c, r) || isReservedTile(this.dungeon, c, r)) continue;
        candidates.push({ c, r });
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = temp;
    }

    const occupied = this.occupiedTiles();
    const foreign = occupied.filter(
      (tile) => tile.c >= room.c && tile.c < room.c + room.w && tile.r >= room.r && tile.r < room.r + room.h,
    );
    const midC = room.c + room.w / 2;
    const midR = room.r + room.h / 2;
    candidates.sort((a, b) => this.anchorScore(b, foreign, midC, midR) - this.anchorScore(a, foreign, midC, midR));

    const blocksPack = (tile: GridPoint) => this.tooCloseToForeign(tile, occupied) || this.nearPartySpawn(tile);
    const clusterReach = count <= 4 ? 1 : 2;
    for (const anchor of candidates) {
      if (blocksPack(anchor)) continue;
      const taken = new Set(foreign.map((tile) => tileKey(tile.c, tile.r)));
      const spots: GridPoint[] = [];
      const reserved = (c: number, r: number) =>
        c < room.c ||
        c >= room.c + room.w ||
        r < room.r ||
        r >= room.r + room.h ||
        Math.max(Math.abs(c - anchor.c), Math.abs(r - anchor.r)) > clusterReach ||
        taken.has(tileKey(c, r)) ||
        isReservedTile(this.dungeon, c, r) ||
        blocksPack({ c, r });
      for (let i = 0; i < count; i++) {
        const spot = nearestOpen(this.dungeon.blocked, anchor, reserved);
        if (!spot) break;
        taken.add(tileKey(spot.c, spot.r));
        spots.push(spot);
      }
      if (spots.length === count) return spots;
    }
    return [];
  }

  private anchorScore(tile: GridPoint, foreign: GridPoint[], midC: number, midR: number): number {
    const fromCenter = Math.hypot(tile.c - midC, tile.r - midR);
    if (foreign.length === 0) return fromCenter;
    let nearest = Infinity;
    const here = gridCenter(tile, TILE);
    for (const other of foreign) {
      const there = gridCenter(other, TILE);
      nearest = Math.min(nearest, Math.hypot(here.x - there.x, here.y - there.y));
    }
    return nearest + fromCenter * 0.25;
  }

  private occupiedTiles(): GridPoint[] {
    const tiles: GridPoint[] = [];
    for (const u of living(this.units)) {
      tiles.push(worldToGrid(u.x, u.y, TILE, this.dungeon.cols, this.dungeon.rows));
    }
    return tiles;
  }

  private tooCloseToForeign(tile: GridPoint, foreign: GridPoint[]): boolean {
    const here = gridCenter(tile, TILE);
    for (const other of foreign) {
      const there = gridCenter(other, TILE);
      if (Math.hypot(here.x - there.x, here.y - there.y) <= ENEMY_GROUP_SEPARATION) return true;
    }
    return false;
  }

  /** Party slots are the entry tiles nearest the `start` portal, so a padded radius covers them. */
  private nearPartySpawn(tile: GridPoint): boolean {
    const here = gridCenter(tile, TILE);
    const start = gridCenter(this.dungeon.start, TILE);
    return Math.hypot(here.x - start.x, here.y - start.y) <= PARTY_SPAWN_GUARD;
  }

  private addGroup(anchor: GridPoint, spots: GridPoint[]): EnemyGroup {
    const unitIds = spots.map((spot) => this.addEnemy(spot));
    const group: EnemyGroup = {
      id: `pack-${this.nextGroup++}`,
      anchor,
      unitIds,
    };
    this.groups.push(group);
    return group;
  }

  private taken(): Set<string> {
    const keys = new Set<string>();
    for (const u of living(this.units)) {
      const g = worldToGrid(u.x, u.y, TILE, this.dungeon.cols, this.dungeon.rows);
      keys.add(tileKey(g.c, g.r));
    }
    return keys;
  }

  private groupAt(x: number, y: number): EnemyGroup | undefined {
    let best: EnemyGroup | undefined;
    let bestD = 28;
    for (const group of this.groups) {
      for (const id of group.unitIds) {
        const u = this.units.find((unit) => unit.id === id);
        if (!u || u.stats.health <= 0) continue;
        const d = Math.hypot(u.x - x, u.y - y);
        if (d < bestD) {
          bestD = d;
          best = group;
        }
      }
    }
    return best;
  }

  private addEnemy(spot: GridPoint): string {
    const center = gridCenter(spot, TILE);
    const id = `enemy-${this.nextUnit++}`;
    this.units.push({
      id,
      side: "enemy",
      role: "dps",
      appearance: ENEMY_APPEARANCE,
      stats: enemyStats(),
      autoAttack: true,
      selected: false,
      cooldown: 0,
      path: [],
      order: null,
      ai: "idle",
      threat: new Map(),
      x: center.x,
      y: center.y,
    });
    return id;
  }
}
