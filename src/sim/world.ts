import { COLS, makeStats, MAX_FRIENDLIES, ROWS, TILE, attackRange } from "./balance";
import { act, enemyTarget, living, type HealFx } from "./combat";
import { gridCenter, tileKey, worldToGrid, type GridPoint } from "./grid";
import { createBlocked } from "./map";
import { findPath, nearestOpen } from "./path";
import type { HudState, RangeType, Role, Side, UnitSnapshot } from "./types";
import type { MoveAssign, SimUnit } from "./unit";

const ROSTER: Array<{ role: Role; rangeType: RangeType; c: number; r: number }> = [
  { role: "tank", rangeType: "melee", c: 3, r: 7 },
  { role: "tank", rangeType: "melee", c: 3, r: 10 },
  { role: "dps", rangeType: "melee", c: 5, r: 6 },
  { role: "dps", rangeType: "ranged", c: 5, r: 11 },
  { role: "healer", rangeType: "melee", c: 2, r: 8 },
  { role: "healer", rangeType: "ranged", c: 2, r: 9 },
];

/**
 * Phaser-free field: occupancy, orders, chase, combat clocks.
 * Two living units may path through the same tile; they must not *stop* on it.
 */
export class World {
  units: SimUnit[] = [];
  blocked: boolean[][] = createBlocked();
  private nextId = 1;
  private heals: HealFx[] = [];

  constructor() {
    this.spawnDefaultFriendlies();
  }

  reset(): void {
    this.units = [];
    this.nextId = 1;
    this.heals = [];
    this.spawnDefaultFriendlies();
  }

  spawnEnemy(): void {
    const seed: GridPoint = {
      c: COLS - 2,
      r: 2 + Math.floor(Math.random() * (ROWS - 4)),
    };
    const spot = nearestOpen(this.blocked, seed, (c, r) => this.unitStoppedOn(c, r, "")) ?? seed;
    this.addUnit("enemy", "dps", "melee", spot.c, spot.r);
  }

  selectClick(x: number, y: number, shift: boolean): void {
    const hit = this.friendlyAt(x, y);
    if (!shift) this.clearSelect();
    if (hit) hit.selected = shift ? !hit.selected : true;
  }

  selectBox(x1: number, y1: number, x2: number, y2: number, shift: boolean): void {
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    if (!shift) this.clearSelect();
    for (const u of living(this.units, "friendly")) {
      if (u.x >= left && u.x <= right && u.y >= top && u.y <= bottom) u.selected = true;
    }
  }

  orderMove(x: number, y: number): void {
    for (const { unit, goal } of this.moveAssignments(x, y)) {
      const start = this.toGrid(unit);
      unit.path = findPath(this.blocked, start, goal);
    }
  }

  /**
   * Lands each selected friendly on a unique free tile near the click.
   * Preview and `orderMove` share this so the ghost matches the path.
   */
  moveAssignments(x: number, y: number): MoveAssign[] {
    const click = worldToGrid(x, y, TILE, COLS, ROWS);
    const selected = living(this.units, "friendly").filter((u) => u.selected);
    const out: MoveAssign[] = [];
    const reserved = new Set<string>();
    for (const u of living(this.units)) {
      if (u.selected) continue;
      if (u.path.length > 0) continue;
      const p = this.toGrid(u);
      reserved.add(tileKey(p.c, p.r));
    }
    for (const u of selected) {
      const start = this.toGrid(u);
      const goal =
        nearestOpen(this.blocked, click, (c, r) => reserved.has(tileKey(c, r))) ?? start;
      reserved.add(tileKey(goal.c, goal.r));
      out.push({ unit: u, goal });
    }
    return out;
  }

  /** Flip auto-attack on the selection, or the whole raid if nothing is selected. */
  toggleAutoAttack(): void {
    const friendlies = living(this.units, "friendly");
    const selected = friendlies.filter((u) => u.selected);
    const targets = selected.length > 0 ? selected : friendlies;
    const anyOn = targets.some((u) => u.autoAttack);
    for (const u of targets) u.autoAttack = !anyOn;
  }

  /** No combat while a unit still has a path. After moves, unstick stacks then chase. */
  tick(delta: number): void {
    for (const u of this.units) {
      if (u.stats.health <= 0) continue;
      this.stepMove(u, delta);
      u.cooldown = Math.max(0, u.cooldown - delta);
      if (u.cooldown <= 0 && u.path.length === 0) {
        const heal = act(this.units, u);
        if (heal) this.heals.push(heal);
      }
    }
    this.spreadStacked();
    this.purgeDead();
    this.updateEnemyChase();
  }

  /** Drain heal bolts spawned this tick for the view. */
  takeHeals(): HealFx[] {
    const out = this.heals;
    this.heals = [];
    return out;
  }

  hud(): HudState {
    const livingE = living(this.units, "enemy");
    const threatLines = livingE.map((e) => {
      const t = enemyTarget(this.units, e);
      const v = t ? (e.threat.get(t.id) ?? 0) : 0;
      return `${e.id} → ${t ? t.role : "nearest"} (${v})`;
    });
    return {
      selected: living(this.units, "friendly")
        .filter((u) => u.selected)
        .map((u) => this.snapshot(u)),
      friendlyAlive: living(this.units, "friendly").length,
      enemyAlive: livingE.length,
      threatLines,
    };
  }

  private spawnDefaultFriendlies(): void {
    for (const row of ROSTER) {
      this.addUnit("friendly", row.role, row.rangeType, row.c, row.r);
    }
  }

  private addUnit(side: Side, role: Role, rangeType: RangeType, c: number, r: number): void {
    if (side === "friendly") {
      if (living(this.units, "friendly").length >= MAX_FRIENDLIES) return;
    }
    const center = gridCenter({ c, r }, TILE);
    this.units.push({
      id: `${side}-${this.nextId++}`,
      side,
      role,
      rangeType: side === "enemy" || role === "tank" ? "melee" : rangeType,
      stats: makeStats(side, role, rangeType),
      autoAttack: true,
      selected: false,
      cooldown: 0,
      path: [],
      threat: new Map(),
      x: center.x,
      y: center.y,
    });
  }

  private clearSelect(): void {
    for (const u of this.units) u.selected = false;
  }

  private toGrid(u: SimUnit): GridPoint {
    return worldToGrid(u.x, u.y, TILE, COLS, ROWS);
  }

  private stepMove(u: SimUnit, delta: number): void {
    if (u.path.length === 0) return;
    const next = gridCenter(u.path[0], TILE);
    const dx = next.x - u.x;
    const dy = next.y - u.y;
    const dist = Math.hypot(dx, dy);
    const step = (u.stats.movementSpeed * delta) / 1000;
    if (dist <= step) {
      u.x = next.x;
      u.y = next.y;
      u.path.shift();
      if (u.path.length === 0) this.unstick(u);
      return;
    }
    u.x += (dx / dist) * step;
    u.y += (dy / dist) * step;
  }

  /** Idle extras on a shared tile path off; the first occupant stays. */
  private spreadStacked(): void {
    const buckets = new Map<string, SimUnit[]>();
    for (const u of living(this.units)) {
      if (u.path.length > 0) continue;
      const p = this.toGrid(u);
      const k = tileKey(p.c, p.r);
      const list = buckets.get(k) ?? [];
      list.push(u);
      buckets.set(k, list);
    }
    for (const stacked of buckets.values()) {
      if (stacked.length < 2) continue;
      for (const extra of stacked.slice(1)) this.unstick(extra);
    }
  }

  private unstick(u: SimUnit): void {
    const here = this.toGrid(u);
    if (!this.unitStoppedOn(here.c, here.r, u.id)) return;
    const free = nearestOpen(this.blocked, here, (c, r) => this.unitStoppedOn(c, r, u.id));
    if (!free) return;
    u.path = findPath(this.blocked, here, free);
  }

  /** True if another *idle* living unit already occupies the cell. Movers do not count. */
  private unitStoppedOn(c: number, r: number, exceptId: string): boolean {
    return living(this.units).some((other) => {
      if (other.id === exceptId || other.path.length > 0) return false;
      const p = this.toGrid(other);
      return p.c === c && p.r === r;
    });
  }

  /** Idle enemies path to a unique tile around their threat target, melee range excluded. */
  private updateEnemyChase(): void {
    const reserved = new Set<string>();
    for (const u of living(this.units)) {
      if (u.path.length > 0) continue;
      const p = this.toGrid(u);
      reserved.add(tileKey(p.c, p.r));
    }
    for (const u of this.units) {
      if (u.side !== "enemy" || u.stats.health <= 0) continue;
      if (u.path.length > 0) continue;
      const target = enemyTarget(this.units, u);
      if (!target) continue;
      if (Math.hypot(u.x - target.x, u.y - target.y) <= attackRange("melee")) continue;
      const start = this.toGrid(u);
      reserved.delete(tileKey(start.c, start.r));
      const around = this.toGrid(target);
      const goal =
        nearestOpen(this.blocked, around, (c, r) => reserved.has(tileKey(c, r))) ?? start;
      reserved.add(tileKey(goal.c, goal.r));
      u.path = findPath(this.blocked, start, goal);
    }
  }

  private friendlyAt(x: number, y: number): SimUnit | undefined {
    return living(this.units, "friendly").find((u) => Math.hypot(u.x - x, u.y - y) < 16);
  }

  private purgeDead(): void {
    for (const u of this.units) {
      if (u.stats.health > 0) continue;
      u.selected = false;
      u.path = [];
    }
  }

  private snapshot(u: SimUnit): UnitSnapshot {
    let threatTargetId: string | null = null;
    let threatValue = 0;
    if (u.side === "enemy") {
      const t = enemyTarget(this.units, u);
      threatTargetId = t?.id ?? null;
      threatValue = t ? (u.threat.get(t.id) ?? 0) : 0;
    }
    return {
      id: u.id,
      side: u.side,
      role: u.role,
      rangeType: u.rangeType,
      autoAttack: u.autoAttack,
      health: Math.max(0, Math.round(u.stats.health)),
      maxHealth: u.stats.maxHealth,
      mana: Math.round(u.stats.mana),
      maxMana: u.stats.maxMana,
      selected: u.selected,
      threatTargetId,
      threatValue,
    };
  }
}
