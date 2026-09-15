import Phaser from "phaser";
import {
  attackRange,
  COLS,
  cooldownMs,
  HEAL_MANA_COST,
  HEALER_THREAT,
  incomingDamage,
  makeStats,
  MAX_FRIENDLIES,
  ROWS,
  TILE,
  TANK_THREAT,
  DPS_THREAT,
} from "./balance";
import { setHudState } from "./hudStore";
import { findPath, nearestOpen, type GridPoint } from "./path";
import type { RangeType, Role, Side, Stats, UnitSnapshot } from "./types";

type RaidUnit = {
  id: string;
  side: Side;
  role: Role;
  rangeType: RangeType;
  stats: Stats;
  autoAttack: boolean;
  selected: boolean;
  cooldown: number;
  path: GridPoint[];
  threat: Map<string, number>;
  body: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Arc;
  hpBar: Phaser.GameObjects.Rectangle;
  manaBar: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

const FORM = {
  enemy: 0xcc3333,
  tank: 0x3b82f6,
  dps: 0xeab308,
  healer: 0x22c55e,
} as const;

export type RaidCommands = {
  spawnEnemy: () => void;
  toggleAutoAttack: () => void;
  reset: () => void;
};

let commands: RaidCommands | null = null;

export function getRaidCommands(): RaidCommands | null {
  return commands;
}

export class RaidScene extends Phaser.Scene {
  private units: RaidUnit[] = [];
  private blocked: boolean[][] = [];
  private nextId = 1;
  private boxStart: Phaser.Math.Vector2 | null = null;
  private boxGfx!: Phaser.GameObjects.Graphics;
  private previewGfx!: Phaser.GameObjects.Graphics;
  private moveHeld = false;
  private shift = false;

  constructor() {
    super("raid");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x1a1f16);
    this.buildGrid();
    this.boxGfx = this.add.graphics().setDepth(20);
    this.previewGfx = this.add.graphics().setDepth(21);
    this.input.mouse?.disableContextMenu();

    this.input.keyboard?.on("keydown-SHIFT", () => {
      this.shift = true;
    });
    this.input.keyboard?.on("keyup-SHIFT", () => {
      this.shift = false;
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        this.moveHeld = true;
        return;
      }
      if (p.leftButtonDown()) {
        this.boxStart = new Phaser.Math.Vector2(p.worldX, p.worldY);
      }
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (p.button === 2) {
        if (this.moveHeld) this.orderMove(p.worldX, p.worldY);
        this.moveHeld = false;
        this.previewGfx.clear();
        return;
      }
      if (p.button !== 0) return;
      if (!this.boxStart) return;
      const dx = p.worldX - this.boxStart.x;
      const dy = p.worldY - this.boxStart.y;
      if (Math.hypot(dx, dy) > 8) {
        this.selectBox(this.boxStart.x, this.boxStart.y, p.worldX, p.worldY);
      } else {
        this.selectClick(p.worldX, p.worldY);
      }
      this.boxStart = null;
      this.boxGfx.clear();
    });

    this.spawnDefaultFriendlies();
    commands = {
      spawnEnemy: () => this.spawnEnemy(),
      toggleAutoAttack: () => this.toggleAutoAttack(),
      reset: () => this.resetField(),
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      commands = null;
    });
    this.publishHud();
  }

  update(_t: number, delta: number): void {
    this.drawBox();
    this.drawMovePreview();
    for (const u of this.units) {
      if (u.stats.health <= 0) continue;
      this.stepMove(u, delta);
      u.cooldown = Math.max(0, u.cooldown - delta);
      if (u.cooldown <= 0 && u.path.length === 0) {
        this.act(u);
      }
    }
    this.spreadStackedUnits();
    this.purgeDead();
    this.updateEnemyChase();
    this.redrawUnits();
    this.publishHud();
  }

  private buildGrid(): void {
    this.blocked = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const walls: Array<[number, number, number, number]> = [
      [8, 4, 3, 2],
      [14, 10, 4, 2],
      [20, 5, 2, 4],
    ];
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x24301c, 1);
    g.fillRect(0, 0, COLS * TILE, ROWS * TILE);
    g.lineStyle(1, 0x2f3d24, 0.5);
    for (let c = 0; c <= COLS; c++) g.lineBetween(c * TILE, 0, c * TILE, ROWS * TILE);
    for (let r = 0; r <= ROWS; r++) g.lineBetween(0, r * TILE, COLS * TILE, r * TILE);
    g.fillStyle(0x4b5563, 1);
    for (const [c, r, w, h] of walls) {
      for (let y = r; y < r + h; y++) {
        for (let x = c; x < c + w; x++) {
          this.blocked[y][x] = true;
        }
      }
      g.fillRect(c * TILE, r * TILE, w * TILE, h * TILE);
    }
  }

  private spawnDefaultFriendlies(): void {
    const roster: Array<{ role: Role; rangeType: RangeType; c: number; r: number }> = [
      { role: "tank", rangeType: "melee", c: 3, r: 7 },
      { role: "tank", rangeType: "melee", c: 3, r: 10 },
      { role: "dps", rangeType: "melee", c: 5, r: 6 },
      { role: "dps", rangeType: "ranged", c: 5, r: 11 },
      { role: "healer", rangeType: "melee", c: 2, r: 8 },
      { role: "healer", rangeType: "ranged", c: 2, r: 9 },
    ];
    for (const row of roster) {
      this.addUnit("friendly", row.role, row.rangeType, row.c, row.r);
    }
  }

  private spawnEnemy(): void {
    const seed: GridPoint = {
      c: COLS - 2,
      r: 2 + Math.floor(Math.random() * (ROWS - 4)),
    };
    const spot =
      nearestOpen(this.blocked, seed, (c, r) => this.unitStoppedOn(c, r, "")) ?? seed;
    this.addUnit("enemy", "dps", "melee", spot.c, spot.r);
  }

  private addUnit(side: Side, role: Role, rangeType: RangeType, c: number, r: number): void {
    if (side === "friendly") {
      const n = this.units.filter((u) => u.side === "friendly" && u.stats.health > 0).length;
      if (n >= MAX_FRIENDLIES) return;
    }
    const id = `${side}-${this.nextId++}`;
    const stats = makeStats(side, role, rangeType);
    const x = c * TILE + TILE / 2;
    const y = r * TILE + TILE / 2;
    const body = this.add.container(x, y).setDepth(5);
    const shape = this.makeForm(side, role);
    const ring = this.add.circle(0, 0, 18, 0x000000, 0).setStrokeStyle(2, 0xfef08a, 0);
    const hpBar = this.add.rectangle(0, -20, 22, 3, 0x22c55e).setOrigin(0.5);
    const manaBar = this.add.rectangle(0, -16, 22, 2, 0x38bdf8).setOrigin(0.5);
    manaBar.setVisible(stats.maxMana > 0);
    const label = this.add
      .text(0, 16, "", { fontSize: "9px", color: "#e5e7eb" })
      .setOrigin(0.5);
    body.add([ring, shape, hpBar, manaBar, label]);
    this.units.push({
      id,
      side,
      role,
      rangeType: side === "enemy" || role === "tank" ? "melee" : rangeType,
      stats,
      autoAttack: true,
      selected: false,
      cooldown: 0,
      path: [],
      threat: new Map(),
      body,
      ring,
      hpBar,
      manaBar,
      label,
    });
  }

  private makeForm(side: Side, role: Role): Phaser.GameObjects.GameObject {
    const g = this.add.graphics();
    if (side === "enemy") {
      g.fillStyle(FORM.enemy);
      g.fillRect(-9, -9, 18, 18);
      return g;
    }
    if (role === "tank") {
      g.fillStyle(FORM.tank);
      g.fillTriangle(0, -12, 12, 6, -12, 6);
      return g;
    }
    g.fillStyle(role === "healer" ? FORM.healer : FORM.dps);
    g.fillCircle(0, 0, 10);
    return g;
  }

  private worldToGrid(x: number, y: number): GridPoint {
    return {
      c: Phaser.Math.Clamp(Math.floor(x / TILE), 0, COLS - 1),
      r: Phaser.Math.Clamp(Math.floor(y / TILE), 0, ROWS - 1),
    };
  }

  private gridCenter(p: GridPoint): { x: number; y: number } {
    return { x: p.c * TILE + TILE / 2, y: p.r * TILE + TILE / 2 };
  }

  private selectClick(x: number, y: number): void {
    const hit = this.friendlyAt(x, y);
    if (!this.shift) this.clearSelect();
    if (hit) hit.selected = this.shift ? !hit.selected : true;
  }

  private selectBox(x1: number, y1: number, x2: number, y2: number): void {
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    if (!this.shift) this.clearSelect();
    for (const u of this.livingFriendlies()) {
      if (u.body.x >= left && u.body.x <= right && u.body.y >= top && u.body.y <= bottom) {
        u.selected = true;
      }
    }
  }

  private clearSelect(): void {
    for (const u of this.units) u.selected = false;
  }

  private orderMove(x: number, y: number): void {
    for (const { unit, goal } of this.moveAssignments(x, y)) {
      const start = this.worldToGrid(unit.body.x, unit.body.y);
      unit.path = findPath(this.blocked, start, goal);
    }
  }

  private moveAssignments(x: number, y: number): { unit: RaidUnit; goal: GridPoint }[] {
    const click = this.worldToGrid(x, y);
    const selected = this.livingFriendlies().filter((u) => u.selected);
    const out: { unit: RaidUnit; goal: GridPoint }[] = [];
    const reserved = new Set<string>();
    for (const u of this.livingUnits()) {
      if (u.selected) continue;
      if (u.path.length > 0) continue;
      const p = this.worldToGrid(u.body.x, u.body.y);
      reserved.add(`${p.c},${p.r}`);
    }
    for (const u of selected) {
      const start = this.worldToGrid(u.body.x, u.body.y);
      const goal =
        nearestOpen(this.blocked, click, (c, r) => reserved.has(`${c},${r}`)) ?? start;
      reserved.add(`${goal.c},${goal.r}`);
      out.push({ unit: u, goal });
    }
    return out;
  }

  private stepMove(u: RaidUnit, delta: number): void {
    if (u.path.length === 0) return;
    const next = this.gridCenter(u.path[0]);
    const dx = next.x - u.body.x;
    const dy = next.y - u.body.y;
    const dist = Math.hypot(dx, dy);
    const step = (u.stats.movementSpeed * delta) / 1000;
    if (dist <= step) {
      u.body.x = next.x;
      u.body.y = next.y;
      u.path.shift();
      if (u.path.length === 0) this.unstickUnit(u);
      return;
    }
    u.body.x += (dx / dist) * step;
    u.body.y += (dy / dist) * step;
  }

  private spreadStackedUnits(): void {
    const buckets = new Map<string, RaidUnit[]>();
    for (const u of this.livingUnits()) {
      if (u.path.length > 0) continue;
      const p = this.worldToGrid(u.body.x, u.body.y);
      const k = `${p.c},${p.r}`;
      const list = buckets.get(k) ?? [];
      list.push(u);
      buckets.set(k, list);
    }
    for (const stacked of buckets.values()) {
      if (stacked.length < 2) continue;
      for (const extra of stacked.slice(1)) this.unstickUnit(extra);
    }
  }

  private unstickUnit(u: RaidUnit): void {
    const here = this.worldToGrid(u.body.x, u.body.y);
    if (!this.unitStoppedOn(here.c, here.r, u.id)) return;
    const free = nearestOpen(this.blocked, here, (c, r) => this.unitStoppedOn(c, r, u.id));
    if (!free) return;
    u.path = findPath(this.blocked, here, free);
  }

  private unitStoppedOn(c: number, r: number, exceptId: string): boolean {
    return this.livingUnits().some((other) => {
      if (other.id === exceptId || other.path.length > 0) return false;
      const p = this.worldToGrid(other.body.x, other.body.y);
      return p.c === c && p.r === r;
    });
  }

  private act(u: RaidUnit): void {
    if (u.side === "enemy") {
      this.enemyAttack(u);
      return;
    }
    if (u.role === "healer" && this.tryHeal(u)) {
      u.cooldown = cooldownMs(u.stats.attackSpeed);
      return;
    }
    if (!u.autoAttack) return;
    const target = this.nearestLiving(u, "enemy", attackRange(u.rangeType));
    if (!target) return;
    this.strike(u, target);
    u.cooldown = cooldownMs(u.stats.attackSpeed);
  }

  private tryHeal(healer: RaidUnit): boolean {
    if (healer.stats.mana < HEAL_MANA_COST) return false;
    const range = attackRange(healer.rangeType);
    let best: RaidUnit | null = null;
    for (const f of this.livingFriendlies()) {
      if (f.stats.health >= f.stats.maxHealth) continue;
      if (this.dist(healer, f) > range) continue;
      if (!best || f.stats.health < best.stats.health) best = f;
    }
    if (!best) return false;
    healer.stats.mana -= HEAL_MANA_COST;
    best.stats.health = Math.min(best.stats.maxHealth, best.stats.health + healer.stats.magicPower);
    return true;
  }

  private enemyAttack(u: RaidUnit): void {
    const target = this.enemyTarget(u);
    if (!target) return;
    if (this.dist(u, target) > attackRange("melee")) return;
    this.strike(u, target);
    u.cooldown = cooldownMs(u.stats.attackSpeed);
  }

  private strike(attacker: RaidUnit, defender: RaidUnit): void {
    defender.stats.health -= incomingDamage(attacker.stats.attackPower, defender.stats.armor);
    if (attacker.side === "friendly" && defender.side === "enemy") {
      const add =
        attacker.role === "tank" ? TANK_THREAT : attacker.role === "healer" ? HEALER_THREAT : DPS_THREAT;
      defender.threat.set(attacker.id, (defender.threat.get(attacker.id) ?? 0) + add);
    }
  }

  private enemyTarget(u: RaidUnit): RaidUnit | null {
    let bestId: string | null = null;
    let best = -1;
    for (const [id, v] of u.threat) {
      const f = this.units.find((x) => x.id === id && x.side === "friendly" && x.stats.health > 0);
      if (!f) {
        u.threat.delete(id);
        continue;
      }
      if (v > best) {
        best = v;
        bestId = id;
      }
    }
    if (bestId) return this.units.find((x) => x.id === bestId) ?? null;
    return this.nearestLiving(u, "friendly", 1e9);
  }

  private updateEnemyChase(): void {
    const reserved = new Set<string>();
    for (const u of this.livingUnits()) {
      if (u.path.length > 0) continue;
      const p = this.worldToGrid(u.body.x, u.body.y);
      reserved.add(`${p.c},${p.r}`);
    }
    for (const u of this.units) {
      if (u.side !== "enemy" || u.stats.health <= 0) continue;
      if (u.path.length > 0) continue;
      const target = this.enemyTarget(u);
      if (!target) continue;
      if (this.dist(u, target) <= attackRange("melee")) continue;
      const start = this.worldToGrid(u.body.x, u.body.y);
      reserved.delete(`${start.c},${start.r}`);
      const around = this.worldToGrid(target.body.x, target.body.y);
      const goal =
        nearestOpen(this.blocked, around, (c, r) => reserved.has(`${c},${r}`)) ?? start;
      reserved.add(`${goal.c},${goal.r}`);
      u.path = findPath(this.blocked, start, goal);
    }
  }

  private nearestLiving(from: RaidUnit, side: Side, range: number): RaidUnit | null {
    let best: RaidUnit | null = null;
    let bestD = range;
    for (const u of this.units) {
      if (u.side !== side || u.stats.health <= 0 || u.id === from.id) continue;
      const d = this.dist(from, u);
      if (d <= bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }

  private dist(a: RaidUnit, b: RaidUnit): number {
    return Math.hypot(a.body.x - b.body.x, a.body.y - b.body.y);
  }

  private friendlyAt(x: number, y: number): RaidUnit | undefined {
    return this.livingFriendlies().find((u) => Math.hypot(u.body.x - x, u.body.y - y) < 16);
  }

  private livingFriendlies(): RaidUnit[] {
    return this.units.filter((u) => u.side === "friendly" && u.stats.health > 0);
  }

  private livingUnits(): RaidUnit[] {
    return this.units.filter((u) => u.stats.health > 0);
  }

  private purgeDead(): void {
    for (const u of this.units) {
      if (u.stats.health > 0) continue;
      u.body.setVisible(false);
      u.selected = false;
      u.path = [];
    }
  }

  private toggleAutoAttack(): void {
    const selected = this.livingFriendlies().filter((u) => u.selected);
    const targets = selected.length > 0 ? selected : this.livingFriendlies();
    const anyOn = targets.some((u) => u.autoAttack);
    for (const u of targets) u.autoAttack = !anyOn;
  }

  private resetField(): void {
    for (const u of this.units) u.body.destroy();
    this.units = [];
    this.nextId = 1;
    this.spawnDefaultFriendlies();
  }

  private drawBox(): void {
    this.boxGfx.clear();
    if (!this.boxStart) return;
    const p = this.input.activePointer;
    this.boxGfx.lineStyle(1, 0xfef08a, 0.9);
    this.boxGfx.strokeRect(
      this.boxStart.x,
      this.boxStart.y,
      p.worldX - this.boxStart.x,
      p.worldY - this.boxStart.y,
    );
  }

  private drawMovePreview(): void {
    this.previewGfx.clear();
    if (!this.moveHeld) return;
    const p = this.input.activePointer;
    this.previewGfx.lineStyle(1, 0xffffff, 0.95);
    for (const { unit, goal } of this.moveAssignments(p.worldX, p.worldY)) {
      const dest = this.gridCenter(goal);
      this.previewGfx.lineBetween(unit.body.x, unit.body.y, dest.x, dest.y);
      this.previewGfx.strokeCircle(dest.x, dest.y, TILE * 0.42);
    }
  }

  private redrawUnits(): void {
    for (const u of this.units) {
      if (u.stats.health <= 0) continue;
      u.ring.setStrokeStyle(2, 0xfef08a, u.selected ? 1 : 0);
      const hp = u.stats.health / u.stats.maxHealth;
      u.hpBar.width = 22 * hp;
      u.hpBar.fillColor = hp > 0.4 ? 0x22c55e : 0xef4444;
      if (u.stats.maxMana > 0) {
        u.manaBar.width = 22 * (u.stats.mana / u.stats.maxMana);
      }
      if (u.side === "enemy") {
        const t = this.enemyTarget(u);
        u.label.setText(t ? t.role.slice(0, 1) : "-");
      } else {
        u.label.setText(u.rangeType === "ranged" ? "R" : "M");
      }
    }
  }

  private snapshot(u: RaidUnit): UnitSnapshot {
    let threatTargetId: string | null = null;
    let threatValue = 0;
    if (u.side === "enemy") {
      const t = this.enemyTarget(u);
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

  private publishHud(): void {
    const livingE = this.units.filter((u) => u.side === "enemy" && u.stats.health > 0);
    const threatLines = livingE.map((e) => {
      const t = this.enemyTarget(e);
      const v = t ? (e.threat.get(t.id) ?? 0) : 0;
      return `${e.id} → ${t ? t.role : "nearest"} (${v})`;
    });
    setHudState({
      selected: this.livingFriendlies().filter((u) => u.selected).map((u) => this.snapshot(u)),
      friendlyAlive: this.livingFriendlies().length,
      enemyAlive: livingE.length,
      threatLines,
    });
  }
}
