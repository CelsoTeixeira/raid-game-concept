import { ENEMY_APPEARANCE } from "../appearance";
import { makeEnemyStats, TILE } from "./balance";
import { ENEMY_ATTRIBUTES } from "./classes";
import { living } from "./combat";
import {
  countRoomsBySize,
  generateDungeon,
  isFloorTile,
  isReservedTile,
  randomDungeonSeed,
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

/**
 * Dungeon sandbox: walls from {@link generateDungeon}, enemy packs the player stamps on the floor.
 * No friendlies — packs idle in place.
 */
export class DungeonWorld {
  dungeon: Dungeon;
  units: SimUnit[] = [];
  groups: EnemyGroup[] = [];
  packSize = 3;
  private nextUnit = 1;
  private nextGroup = 1;

  constructor(seed?: number) {
    this.dungeon = generateDungeon(seed ?? randomDungeonSeed());
  }

  regenerate(seed?: number): void {
    this.units = [];
    this.groups = [];
    this.nextUnit = 1;
    this.nextGroup = 1;
    this.dungeon = generateDungeon(seed ?? randomDungeonSeed());
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
    const unitIds: string[] = [];
    for (const spot of spots) unitIds.push(this.addEnemy(spot));
    const group: EnemyGroup = {
      id: `pack-${this.nextGroup++}`,
      anchor: from,
      unitIds,
    };
    this.groups.push(group);
    return group;
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
