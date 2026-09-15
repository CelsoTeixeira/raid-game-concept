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
    expect(fx[0]?.amount).toBeGreaterThan(0);
    expect(fx[0] && isHealFx(fx[0]) && fx[0].targetId).toBe(wounded.id);
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
    expect(act(world.units, tank)).toEqual([]);
    const next = gridCenter({ c: here.c + 1, r: here.r }, TILE);
    enemy.x = next.x;
    enemy.y = next.y;
    expect(canAttack(tank, enemy)).toBe(true);
    tank.cooldown = 0;
    const hit = act(world.units, tank);
    expect(hit[0] && !isHealFx(hit[0]) && hit[0].kind).toBe("melee");
  });

  it("tank cleave tags extra nearby enemies with threat", () => {
    const world = new World();
    const tank = world.units.find((u) => u.role === "tank")!;
    world.spawnEnemy();
    world.spawnEnemy();
    const enemies = world.units.filter((u) => u.side === "enemy");
    const here = { c: Math.floor(tank.x / TILE), r: Math.floor(tank.y / TILE) };
    const a = gridCenter({ c: here.c + 1, r: here.r }, TILE);
    const b = gridCenter({ c: here.c + 1, r: here.r + 1 }, TILE);
    enemies[0].x = a.x;
    enemies[0].y = a.y;
    enemies[1].x = b.x;
    enemies[1].y = b.y;
    tank.cooldown = 0;
    const fx = act(world.units, tank);
    expect(fx.length).toBeGreaterThanOrEqual(2);
    expect(enemies[0].threat.get(tank.id)).toBe(3);
    expect(enemies[1].threat.get(tank.id)).toBe(3);
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
