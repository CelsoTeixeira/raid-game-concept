import { describe, expect, it } from "vitest";
import { incomingDamage } from "./balance";
import { act, strike } from "./combat";
import { World } from "./world";

describe("combat numbers", () => {
  it("armor floors at 1 damage", () => {
    expect(incomingDamage(8, 10)).toBe(1);
    expect(incomingDamage(18, 1)).toBe(17);
  });

  it("tank strike adds 3 threat, dps adds 1", () => {
    const world = new World();
    const tank = world.units.find((u) => u.role === "tank")!;
    const dps = world.units.find((u) => u.role === "dps")!;
    world.spawnEnemy();
    const enemy = world.units.find((u) => u.side === "enemy")!;
    strike(tank, enemy);
    strike(dps, enemy);
    expect(enemy.threat.get(tank.id)).toBe(3);
    expect(enemy.threat.get(dps.id)).toBe(1);
  });

  it("healer spends the clock on heal even with auto-attack off", () => {
    const world = new World();
    const healer = world.units.find((u) => u.role === "healer")!;
    const wounded = world.units.find((u) => u.role === "tank")!;
    wounded.stats.health = 10;
    healer.autoAttack = false;
    healer.x = wounded.x;
    healer.y = wounded.y;
    healer.cooldown = 0;
    const fx = act(world.units, healer);
    expect(wounded.stats.health).toBeGreaterThan(10);
    expect(healer.cooldown).toBeGreaterThan(0);
    expect(fx?.amount).toBeGreaterThan(0);
    expect(fx?.targetId).toBe(wounded.id);
  });
});

describe("occupancy", () => {
  it("group move assigns unique landing tiles", () => {
    const world = new World();
    const tanks = world.units.filter((u) => u.role === "tank");
    for (const u of tanks) u.selected = true;
    const dest = { x: tanks[0].x, y: tanks[0].y };
    const goals = world.moveAssignments(dest.x, dest.y).map((a) => `${a.goal.c},${a.goal.r}`);
    expect(new Set(goals).size).toBe(goals.length);
  });

  it("idle extras unstick off a shared tile", () => {
    const world = new World();
    const a = world.units[0];
    const b = world.units[1];
    b.x = a.x;
    b.y = a.y;
    world.tick(16);
    expect(b.path.length).toBeGreaterThan(0);
  });
});
