import { ENEMY_APPEARANCE } from "../appearance";
import { makeEnemyStats, TILE } from "./balance";
import { ENEMY_ATTRIBUTES } from "./classes";
import { living } from "./combat";
import {
  countRoomsBySize,
  generateDungeon,
  isFloorTile,
  isReservedTile,
  mulberry32,
  randomDungeonSeed,
  roomContaining,
  type DungeonRect,
  type Dungeon,
} from "./dungeon";
import { gridCenter, tileKey, worldToGrid, type GridPoint } from "./grid";
import { nearestOpen } from "./path";
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
const GENERATED_PACK_SIZES: Record<Exclude<DungeonRect["size"], "boss">, number> = {
  small: 5,
  medium: 10,
  big: 15,
};

/**
 * Dungeon sandbox: walls from {@link generateDungeon}, with one seeded enemy pack in each
 * ordinary room except the entry and boss rooms. No friendlies — packs idle in place.
 */
export class DungeonWorld {
  dungeon: Dungeon;
  units: SimUnit[] = [];
  groups: EnemyGroup[] = [];
  packSize = 3;
  private nextUnit = 1;
  private nextGroup = 1;

  constructor(encounter?: DungeonEncounter | number) {
    if (typeof encounter === "object") {
      this.dungeon = encounter.dungeon;
      this.restoreGroups(encounter.groups);
      return;
    }

    this.dungeon = generateDungeon(encounter ?? randomDungeonSeed());
    this.populateGeneratedPacks();
  }

  regenerate(seed?: number): void {
    this.units = [];
    this.groups = [];
    this.nextUnit = 1;
    this.nextGroup = 1;
    this.dungeon = generateDungeon(seed ?? randomDungeonSeed());
    this.populateGeneratedPacks();
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
    const entryRoom = roomContaining(this.dungeon, this.dungeon.start.c, this.dungeon.start.r);
    for (const room of this.dungeon.rooms) {
      if (room.size === "boss" || room === entryRoom) continue;
      const spots = this.pickRoomTiles(room, GENERATED_PACK_SIZES[room.size], rng);
      if (spots.length === GENERATED_PACK_SIZES[room.size]) this.addGroup(spots[0], spots);
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

    for (const anchor of candidates) {
      const taken = this.taken();
      const spots: GridPoint[] = [];
      const reserved = (c: number, r: number) =>
        c < room.c ||
        c >= room.c + room.w ||
        r < room.r ||
        r >= room.r + room.h ||
        taken.has(tileKey(c, r)) ||
        isReservedTile(this.dungeon, c, r);
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
      rangeType: "melee",
      unitClass: null,
      subclass: null,
      attributes: { ...ENEMY_ATTRIBUTES },
      appearance: ENEMY_APPEARANCE,
      stats: makeEnemyStats(),
      autoAttack: true,
      selected: false,
      cooldown: 0,
      path: [],
      order: null,
      threat: new Map(),
      x: center.x,
      y: center.y,
    });
    return id;
  }
}
