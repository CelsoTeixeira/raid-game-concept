import { COLS, makeStats, MAX_FRIENDLIES, ROWS, TILE } from "./balance";
import { act, canAttack, enemyTarget, isHealFx, living, regenMana, type HealFx, type HitFx } from "./combat";
import {
  facingFrom,
  layoutSlots,
  nextFormation,
  rankOf,
  snapWalkable,
  slotLabel,
  type Facing,
  type FormationKind,
} from "./formation";
import { gridCenter, worldToGrid, type GridPoint } from "./grid";
import { createBlocked } from "./map";
import { pathToPoint, type WorldPoint } from "./nav";
import { nearestOpen } from "./path";
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
 * All units share world-space paths and formation slots. Friendlies take player orders;
 * enemies issue the same move toward their target.
 */
export class World {
  units: SimUnit[] = [];
  blocked: boolean[][] = createBlocked();
  formation: FormationKind = "raid";
  private facing: Facing = { fx: 1, fy: 0, rx: 0, ry: 1 };
  private nextId = 1;
  private heals: HealFx[] = [];
  private hits: HitFx[] = [];

  constructor() {
    this.spawnDefaultFriendlies();
  }

  reset(): void {
    this.units = [];
    this.nextId = 1;
    this.heals = [];
    this.hits = [];
    this.formation = "raid";
    this.spawnDefaultFriendlies();
  }

  spawnEnemy(): void {
    const seed: GridPoint = {
      c: COLS - 2,
      r: 2 + Math.floor(Math.random() * (ROWS - 4)),
    };
    const spot = nearestOpen(this.blocked, seed, () => false) ?? seed;
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

  cycleFormation(): FormationKind {
    this.formation = nextFormation(this.formation);
    return this.formation;
  }

  setFormation(kind: FormationKind): void {
    this.formation = kind;
  }

  orderMove(x: number, y: number): void {
    this.issuePaths(this.moveAssignments(x, y));
  }

  /**
   * World-space slots for a pack. Preview and `orderMove` share this.
   * Click is the center of the pack. Tanks stay toward the facing direction.
   */
  moveAssignments(x: number, y: number): MoveAssign[] {
    const selected = living(this.units, "friendly").filter((u) => u.selected);
    const { assigns, face } = this.assignFormation(selected, { x, y }, this.formation, this.facing);
    this.facing = face;
    return assigns;
  }

  /** Flip auto-attack on the selection, or the whole raid if nothing is selected. */
  toggleAutoAttack(): void {
    const friendlies = living(this.units, "friendly");
    const selected = friendlies.filter((u) => u.selected);
    const targets = selected.length > 0 ? selected : friendlies;
    const anyOn = targets.some((u) => u.autoAttack);
    for (const u of targets) u.autoAttack = !anyOn;
  }

  /** No combat while a unit still has a path. Units may overlap; only exact ties break. */
  tick(delta: number): void {
    for (const u of this.units) {
      if (u.stats.health <= 0) continue;
      this.stepMove(u, delta);
      regenMana(u, delta);
      u.cooldown = Math.max(0, u.cooldown - delta);
      if (u.cooldown <= 0 && u.path.length === 0) {
        for (const fx of act(this.units, u)) {
          if (isHealFx(fx)) this.heals.push(fx);
          else this.hits.push(fx);
        }
      }
    }
    this.resolveCoincident();
    this.purgeDead();
    this.updateChase();
  }

  /** Drain heal bolts spawned this tick for the view. */
  takeHeals(): HealFx[] {
    const out = this.heals;
    this.heals = [];
    return out;
  }

  takeHits(): HitFx[] {
    const out = this.hits;
    this.hits = [];
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
      formation: this.formation,
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

  private stepMove(u: SimUnit, delta: number): void {
    if (u.path.length === 0) return;
    const next = u.path[0];
    const dx = next.x - u.x;
    const dy = next.y - u.y;
    const dist = Math.hypot(dx, dy);
    const step = (u.stats.movementSpeed * delta) / 1000;
    if (dist <= step) {
      u.x = next.x;
      u.y = next.y;
      u.path.shift();
      return;
    }
    u.x += (dx / dist) * step;
    u.y += (dy / dist) * step;
  }

  private issuePaths(assigns: MoveAssign[]): void {
    for (const { unit, goal } of assigns) {
      unit.path = pathToPoint(this.blocked, { x: unit.x, y: unit.y }, goal);
    }
  }

  /** Same slot layout for player orders and enemy chase. */
  private assignFormation(
    units: SimUnit[],
    dest: WorldPoint,
    kind: FormationKind,
    fallback: Facing,
  ): { assigns: MoveAssign[]; face: Facing } {
    if (units.length === 0) return { assigns: [], face: fallback };
    const cx = units.reduce((s, u) => s + u.x, 0) / units.length;
    const cy = units.reduce((s, u) => s + u.y, 0) / units.length;
    const face = facingFrom({ x: cx, y: cy }, dest, fallback);
    const tanks = units.filter((u) => rankOf(u) === 0).sort((a, b) => a.id.localeCompare(b.id));
    const melee = units.filter((u) => rankOf(u) === 1).sort((a, b) => a.id.localeCompare(b.id));
    const ranged = units.filter((u) => rankOf(u) === 2).sort((a, b) => a.id.localeCompare(b.id));
    const ordered = [...tanks, ...melee, ...ranged];
    const slots = layoutSlots(kind, dest, face, tanks.length, melee.length, ranged.length).map((p) =>
      snapWalkable(this.blocked, p),
    );
    this.uniqPoints(slots);
    return {
      face,
      assigns: ordered.map((unit, i) => ({
        unit,
        goal: slots[i] ?? dest,
        label: slotLabel(unit),
      })),
    };
  }

  /** Enemies order the same formation move toward their target. */
  private updateChase(): void {
    const packs = new Map<string, SimUnit[]>();
    for (const u of living(this.units, "enemy")) {
      const target = enemyTarget(this.units, u);
      if (!target) continue;
      if (canAttack(u, target)) {
        u.path = [];
        continue;
      }
      const list = packs.get(target.id) ?? [];
      list.push(u);
      packs.set(target.id, list);
    }
    for (const [targetId, pack] of packs) {
      const target = this.units.find((x) => x.id === targetId);
      if (!target) continue;
      const { assigns } = this.assignFormation(pack, { x: target.x, y: target.y }, "raid", {
        fx: 1,
        fy: 0,
        rx: 0,
        ry: 1,
      });
      this.issuePaths(assigns);
    }
  }

  /** Idle units may overlap. Only split if they rest on the same point. */
  private resolveCoincident(): void {
    const pack = living(this.units).filter((u) => u.path.length === 0);
    for (let i = 0; i < pack.length; i++) {
      for (let j = i + 1; j < pack.length; j++) {
        const a = pack[i];
        const b = pack[j];
        if (Math.hypot(b.x - a.x, b.y - a.y) >= 1) continue;
        const ang = (j * 2.399) % (Math.PI * 2);
        this.nudge(b, Math.cos(ang) * 8, Math.sin(ang) * 8);
      }
    }
  }

  private uniqPoints(slots: { x: number; y: number }[]): void {
    const seen = new Set<string>();
    for (let i = 0; i < slots.length; i++) {
      let p = slots[i];
      let k = `${Math.round(p.x)},${Math.round(p.y)}`;
      let n = 0;
      while (seen.has(k) && n < 12) {
        const ang = n * 2.399;
        p = snapWalkable(this.blocked, { x: p.x + Math.cos(ang) * 8, y: p.y + Math.sin(ang) * 8 });
        k = `${Math.round(p.x)},${Math.round(p.y)}`;
        n += 1;
      }
      seen.add(k);
      slots[i] = p;
    }
  }

  private nudge(u: SimUnit, dx: number, dy: number): void {
    const x = u.x + dx;
    const y = u.y + dy;
    const g = worldToGrid(x, y, TILE, COLS, ROWS);
    if (this.blocked[g.r][g.c]) return;
    u.x = x;
    u.y = y;
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
