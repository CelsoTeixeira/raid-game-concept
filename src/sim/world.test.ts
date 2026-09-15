import { describe, expect, it } from "vitest";
import { incomingDamage } from "./balance";
import { act, canAttack, isHealFx, strike } from "./combat";
import { TILE } from "./balance";
import { gridCenter } from "./grid";
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
    expect(fx && isHealFx(fx) && fx.targetId).toBe(wounded.id);
  });

  it("melee only swings from an adjacent tile", () => {
    const world = new World();
    const tank = world.units.find((u) => u.role === "tank")!;
    world.spawnEnemy();
    const enemy = world.units.find((u) => u.side === "enemy")!;
    const here = { c: Math.floor(tank.x / TILE), r: Math.floor(tank.y / TILE) };
    const far = gridCenter({ c: here.c + 3, r: here.r }, TILE);
    enemy.x = far.x;
    enemy.y = far.y;
    expect(canAttack(tank, enemy)).toBe(false);
    tank.cooldown = 0;
    expect(act(world.units, tank)).toBeNull();
    const next = gridCenter({ c: here.c + 1, r: here.r }, TILE);
    enemy.x = next.x;
    enemy.y = next.y;
    expect(canAttack(tank, enemy)).toBe(true);
    tank.cooldown = 0;
    const hit = act(world.units, tank);
    expect(hit && !isHealFx(hit) && hit.kind).toBe("melee");
  });

  it("healers regen mana each second and stop at max", () => {
    const world = new World();
    const healer = world.units.find((u) => u.role === "healer")!;
    const tank = world.units.find((u) => u.role === "tank")!;
    healer.stats.mana = 0;
    healer.autoAttack = false;
    world.tick(1000);
    expect(healer.stats.mana).toBeCloseTo(5, 5);
    expect(tank.stats.mana).toBe(0);
    healer.stats.mana = 119;
    world.tick(1000);
    expect(healer.stats.mana).toBe(120);
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
