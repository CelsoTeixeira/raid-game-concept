import { describe, expect, it } from "vitest";
import { TILE } from "./balance";
import { countBossEntrances, generateDungeon } from "./dungeon";
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
      expect(dungeon.boss.size).toBe("boss");
      const east = Math.max(...dungeon.rooms.map((room) => room.c));
      expect(dungeon.boss.c).toBe(east);
      expect(dungeon.end.c).toBeGreaterThanOrEqual(dungeon.boss.c);
      expect(dungeon.end.c).toBeLessThan(dungeon.boss.c + dungeon.boss.w);
      expect(dungeon.end.r).toBeGreaterThanOrEqual(dungeon.boss.r);
      expect(dungeon.end.r).toBeLessThan(dungeon.boss.r + dungeon.boss.h);
    }
  });

  it("links the boss room to a single entrance", () => {
    for (let i = 0; i < 16; i++) {
      const dungeon = generateDungeon(i * 4099 + 3);
      expect(countBossEntrances(dungeon)).toBe(1);
    }
  });
});

describe("dungeon packs", () => {
  it("refuses the start tile and stamps a pack on open floor", () => {
    const world = new DungeonWorld(1);
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
