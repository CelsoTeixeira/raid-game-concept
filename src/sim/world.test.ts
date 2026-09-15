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
  it("group move assigns unique world goals", () => {
    const world = new World();
    const tanks = world.units.filter((u) => u.role === "tank");
    for (const u of tanks) u.selected = true;
    const dest = { x: tanks[0].x + 80, y: tanks[0].y };
    const goals = world.moveAssignments(dest.x, dest.y).map((a) => `${a.goal.x},${a.goal.y}`);
    expect(new Set(goals).size).toBe(goals.length);
  });

  it("solo ranged lands on the click", () => {
    const world = new World();
    world.setFormation("raid");
    const ranged = world.units.find((u) => u.role === "dps" && u.rangeType === "ranged")!;
    ranged.selected = true;
    const click = { x: 400, y: 300 };
    const [assign] = world.moveAssignments(click.x, click.y);
    expect(assign.goal.x).toBeCloseTo(click.x, 0);
    expect(assign.goal.y).toBeCloseTo(click.y, 0);
  });

  it("raid pack centroid sits on the click", () => {
    const world = new World();
    world.setFormation("raid");
    for (const u of world.units) {
      if (u.side === "friendly") u.selected = true;
    }
    const click = { x: 400, y: 300 };
    const assigns = world.moveAssignments(click.x, click.y);
    const mx = assigns.reduce((s, a) => s + a.goal.x, 0) / assigns.length;
    const my = assigns.reduce((s, a) => s + a.goal.y, 0) / assigns.length;
    expect(mx).toBeCloseTo(click.x, 5);
    expect(my).toBeCloseTo(click.y, 5);
  });

  it("raid puts tanks ahead of ranged along the click", () => {
    const world = new World();
    world.setFormation("raid");
    const friendlies = world.units.filter((u) => u.side === "friendly");
    for (const u of friendlies) u.selected = true;
    const click = { x: 400, y: 300 };
    const cx = friendlies.reduce((s, u) => s + u.x, 0) / friendlies.length;
    const cy = friendlies.reduce((s, u) => s + u.y, 0) / friendlies.length;
    const fx = click.x - cx;
    const fy = click.y - cy;
    const assigns = world.moveAssignments(click.x, click.y);
    const tank = assigns.find((a) => a.unit.role === "tank")!;
    const ranged = assigns.find((a) => a.unit.rangeType === "ranged")!;
    const along = (x: number, y: number) => (x - click.x) * fx + (y - click.y) * fy;
    expect(along(tank.goal.x, tank.goal.y)).toBeGreaterThan(along(ranged.goal.x, ranged.goal.y));
  });

  it("idle extras do not rest on the same point", () => {
    const world = new World();
    const a = world.units[0];
    const b = world.units[1];
    b.x = a.x;
    b.y = a.y;
    world.tick(16);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1);
  });

  it("nearby idle units are not pushed apart", () => {
    const world = new World();
    const a = world.units[0];
    const b = world.units[1];
    b.x = a.x + 10;
    b.y = a.y;
    const bx = b.x;
    const by = b.y;
    world.tick(16);
    expect(b.x).toBeCloseTo(bx, 5);
    expect(b.y).toBeCloseTo(by, 5);
  });

  it("enemy pack chase uses unique formation goals", () => {
    const world = new World();
    const tank = world.units.find((u) => u.role === "tank")!;
    world.spawnEnemy();
    world.spawnEnemy();
    const enemies = world.units.filter((u) => u.side === "enemy");
    const far = { x: tank.x + 200, y: tank.y };
    for (const e of enemies) {
      e.x = far.x;
      e.y = far.y;
    }
    world.tick(16);
    const goals = enemies.map((e) => {
      const last = e.path[e.path.length - 1];
      return last ? `${last.x},${last.y}` : `${e.x},${e.y}`;
    });
    expect(new Set(goals).size).toBe(goals.length);
  });
});
