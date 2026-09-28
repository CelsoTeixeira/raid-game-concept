import { describe, expect, it } from "vitest";
import { ENEMY_SOCIAL_RANGE, TILE } from "./balance";
import { countGoalEntrances, generateDungeon, roomContaining } from "./dungeon";
import { DungeonWorld } from "./dungeonWorld";
import { gridCenter } from "./grid";
import { findPath } from "./path";

describe("dungeon generation", () => {
  it("always leaves a walkable start-to-end path", () => {
    for (let i = 0; i < 24; i++) {
      const dungeon = generateDungeon(i * 7919 + 17);
      expect(dungeon.blocked[dungeon.start.r][dungeon.start.c]).toBe(false);
      expect(dungeon.blocked[dungeon.end.r][dungeon.end.c]).toBe(false);
      expect(dungeon.start.c !== dungeon.end.c || dungeon.start.r !== dungeon.end.r).toBe(true);
      const steps = findPath(dungeon.blocked, dungeon.start, dungeon.end);
      expect(steps.length).toBeGreaterThan(0);
      expect(dungeon.path[0]).toEqual(dungeon.start);
      expect(dungeon.path[dungeon.path.length - 1]).toEqual(dungeon.end);
      for (const cell of dungeon.path) {
        expect(dungeon.blocked[cell.r][cell.c]).toBe(false);
      }
    }
  });

  it("keeps room interiors from overlapping", () => {
    const dungeon = generateDungeon(42);
    for (let i = 0; i < dungeon.rooms.length; i++) {
      for (let j = i + 1; j < dungeon.rooms.length; j++) {
        const a = dungeon.rooms[i];
        const b = dungeon.rooms[j];
        const hit =
          a.c < b.c + b.w && a.c + a.w > b.c && a.r < b.r + b.h && a.r + a.h > b.r;
        expect(hit).toBe(false);
      }
    }
  });

  it("uses small, medium, and big rooms, with the boss on the east end", () => {
    for (let i = 0; i < 16; i++) {
      const dungeon = generateDungeon(i * 4099 + 3);
      const sizes = new Set(dungeon.rooms.map((room) => room.size));
      expect(sizes.has("small")).toBe(true);
      expect(sizes.has("medium")).toBe(true);
      expect(sizes.has("big")).toBe(true);
      expect(dungeon.goal.size).toBe("boss");
      const east = Math.max(...dungeon.rooms.map((room) => room.c));
      expect(dungeon.goal.c).toBe(east);
      expect(dungeon.end.c).toBeGreaterThanOrEqual(dungeon.goal.c);
      expect(dungeon.end.c).toBeLessThan(dungeon.goal.c + dungeon.goal.w);
      expect(dungeon.end.r).toBeGreaterThanOrEqual(dungeon.goal.r);
      expect(dungeon.end.r).toBeLessThan(dungeon.goal.r + dungeon.goal.h);
      for (const room of dungeon.rooms) {
        if (room.size === "small") {
          expect(room.w).toBeGreaterThanOrEqual(8);
          expect(room.h).toBeGreaterThanOrEqual(8);
        }
        if (room.size === "medium") {
          expect(room.w).toBeGreaterThanOrEqual(11);
          expect(room.h).toBeGreaterThanOrEqual(9);
        }
        if (room.size === "big") {
          expect(room.w).toBeGreaterThanOrEqual(13);
          expect(room.h).toBeGreaterThanOrEqual(11);
        }
      }
    }
  });

  it("links the boss room to a single entrance", () => {
    for (let i = 0; i < 16; i++) {
      const dungeon = generateDungeon(i * 4099 + 3);
      expect(countGoalEntrances(dungeon)).toBe(1);
    }
  });
});

describe("dungeon packs", () => {
  it("splits ordinary rooms into several packs spaced past social range", () => {
    for (let seed = 0; seed < 12; seed++) {
      const world = new DungeonWorld(seed * 4099 + 3);
      const entry = roomContaining(world.dungeon, world.dungeon.start.c, world.dungeon.start.r);
      const groupsByRoom = new Map<string, typeof world.groups>();
      for (const group of world.groups) {
        const room = roomContaining(world.dungeon, group.anchor.c, group.anchor.r);
        if (!room || room.size === "boss" || room === entry) continue;
        const key = `${room.c},${room.r}`;
        const list = groupsByRoom.get(key) ?? [];
        list.push(group);
        groupsByRoom.set(key, list);
      }

      for (const room of world.dungeon.rooms) {
        if (room.size === "boss" || room === entry) continue;
        const packs = groupsByRoom.get(`${room.c},${room.r}`) ?? [];
        expect(packs.length).toBeGreaterThanOrEqual(room.size === "small" ? 1 : 2);
        const enemies = packs.reduce((n, pack) => n + pack.unitIds.length, 0);
        expect(enemies).toBe(room.size === "small" ? 5 : room.size === "medium" ? 10 : 15);
      }

      for (const packs of groupsByRoom.values()) {
        const living = packs.map((group) => ({
          group,
          units: group.unitIds
            .map((id) => world.units.find((unit) => unit.id === id))
            .filter((unit): unit is NonNullable<typeof unit> => !!unit && unit.stats.health > 0),
        }));
        for (let i = 0; i < living.length; i++) {
          for (let j = i + 1; j < living.length; j++) {
            let closest = Infinity;
            for (const a of living[i].units) {
              for (const b of living[j].units) {
                closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));
              }
            }
            expect(closest).toBeGreaterThan(ENEMY_SOCIAL_RANGE);
          }
        }
      }
    }
  });

  it("refuses the start tile and stamps a pack on open floor", () => {
    const world = new DungeonWorld(1);
    world.clearGroups();
    const start = gridCenter(world.dungeon.start, TILE);
    expect(world.placeGroup(start.x, start.y)).toBeNull();

    const room = world.dungeon.rooms.find((r) => {
      const c = r.c + 1;
      const row = r.r + 1;
      return (
        (c !== world.dungeon.start.c || row !== world.dungeon.start.r) &&
        (c !== world.dungeon.end.c || row !== world.dungeon.end.r) &&
        !world.dungeon.blocked[row][c]
      );
    });
    expect(room).toBeTruthy();
    const at = gridCenter({ c: room!.c + 1, r: room!.r + 1 }, TILE);
    const group = world.placeGroup(at.x, at.y);
    expect(group?.unitIds.length).toBe(3);
    expect(world.units).toHaveLength(3);
    expect(world.units.every((u) => u.side === "enemy")).toBe(true);
    expect(world.units.some((u) => u.side === "friendly")).toBe(false);
  });

  it("removes a whole pack from a unit click", () => {
    const world = new DungeonWorld(1);
    world.clearGroups();
    world.setPackSize(2);
    const room = world.dungeon.rooms[1];
    const at = gridCenter({ c: room.c + 1, r: room.r + 1 }, TILE);
    const group = world.placeGroup(at.x, at.y);
    expect(group).toBeTruthy();
    const unit = world.units[0];
    expect(world.removeGroupAt(unit.x, unit.y)).toBe(true);
    expect(world.units).toHaveLength(0);
    expect(world.groups).toHaveLength(0);
  });
});
