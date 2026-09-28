import Phaser from "phaser";
import { appearanceFrames, type SpriteFrame } from "../appearance";
import { TILE } from "../sim/balance";
import { canHeal, enemyTarget } from "../sim/combat";
import { roomCenter, roomContaining, type Dungeon, type RoomSize } from "../sim/dungeon";
import { gridCenter } from "../sim/grid";
import type { DungeonEncounter } from "../sim/dungeonWorld";
import type { GroupMember } from "../sim/group";
import { isRanged } from "../sim/stats";
import type { SimUnit } from "../sim/unit";
import { World } from "../sim/world";
import { setRaidCommands } from "./commands";
import { drawPortal } from "./portal";
import { HealFxLayer } from "./healFx";
import { HitFxLayer } from "./hitFx";
import { setHudState } from "./hudStore";

const CHARACTER_TEXTURE_KEY = "character-sheet";
const CHARACTER_SHEET_URL = new URL("../assets/roguelikeChar_transparent.png", import.meta.url).href;
const CHARACTER_CELL_SIZE = 16;
const CHARACTER_COLUMNS = 54;
const SLOT_COLORS = {
  tank: 0x3b82f6,
  dps: 0xeab308,
  healer: 0x22c55e,
} as const;
const ROOM_FILL: Record<RoomSize, { floor: number; path: number }> = {
  small: { floor: 0x243044, path: 0x354a44 },
  medium: { floor: 0x2a3344, path: 0x3f5344 },
  big: { floor: 0x364155, path: 0x455a4c },
  boss: { floor: 0x4a2730, path: 0x5c3d32 },
};

type UnitView = {
  id: string;
  body: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Arc;
  hpBar: Phaser.GameObjects.Rectangle;
  manaBar: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

/**
 * Phaser adapter: input, sprites, HUD. All rules live in {@link World}.
 * Hold RMB to preview landings (`moveAssignments`); release to `orderMove`.
 */
export class RaidScene extends Phaser.Scene {
  private world!: World;
  private dungeon!: Dungeon;
  private views = new Map<string, UnitView>();
  private boxStart: Phaser.Math.Vector2 | null = null;
  private boxGfx!: Phaser.GameObjects.Graphics;
  private previewGfx!: Phaser.GameObjects.Graphics;
  private previewLabels: Phaser.GameObjects.Text[] = [];
  private heals = new HealFxLayer(this);
  private hits = new HitFxLayer(this);
  private moveHeld = false;
  private shift = false;

  constructor() {
    super("raid");
  }

  init(data: { group: GroupMember[]; encounter: DungeonEncounter }): void {
    this.dungeon = data.encounter.dungeon;
    this.world = new World(data.group, data.encounter);
  }

  preload(): void {
    this.load.spritesheet(CHARACTER_TEXTURE_KEY, CHARACTER_SHEET_URL, {
      frameWidth: CHARACTER_CELL_SIZE,
      frameHeight: CHARACTER_CELL_SIZE,
      spacing: 1,
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x1a1f16);
    const worldW = this.dungeon.cols * TILE;
    const worldH = this.dungeon.rows * TILE;
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setZoom(Math.min(this.scale.width / worldW, this.scale.height / worldH));
    this.cameras.main.centerOn(worldW / 2, worldH / 2);
    this.drawField();
    this.boxGfx = this.add.graphics().setDepth(20);
    this.previewGfx = this.add.graphics().setDepth(21);
    this.input.mouse?.disableContextMenu();

    this.input.keyboard?.on("keydown-SHIFT", () => {
      this.shift = true;
    });
    this.input.keyboard?.on("keyup-SHIFT", () => {
      this.shift = false;
    });
    this.input.keyboard?.on("keydown-F", () => {
      if (this.moveHeld) this.world.cycleFormation();
    });
    this.input.keyboard?.on("keydown-ONE", () => {
      if (this.moveHeld) this.world.setFormation("raid");
    });
    this.input.keyboard?.on("keydown-TWO", () => {
      if (this.moveHeld) this.world.setFormation("line");
    });
    this.input.keyboard?.on("keydown-THREE", () => {
      if (this.moveHeld) this.world.setFormation("box");
    });
    this.input.on("wheel", () => {
      if (this.moveHeld) this.world.cycleFormation();
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
        if (this.moveHeld && !this.world.tryCommand(p.worldX, p.worldY)) {
          this.world.orderMove(p.worldX, p.worldY);
        }
        this.moveHeld = false;
        this.clearPreview();
        return;
      }
      if (p.button !== 0) return;
      if (!this.boxStart) return;
      const dx = p.worldX - this.boxStart.x;
      const dy = p.worldY - this.boxStart.y;
      if (Math.hypot(dx, dy) > 8) {
        this.world.selectBox(this.boxStart.x, this.boxStart.y, p.worldX, p.worldY, this.shift);
      } else {
        this.world.selectClick(p.worldX, p.worldY, this.shift);
      }
      this.boxStart = null;
      this.boxGfx.clear();
    });

    this.syncViews();
    setRaidCommands({
      spawnEnemy: () => this.world.spawnEnemy(),
      toggleAutoAttack: () => this.world.toggleAutoAttack(),
      reset: () => {
        this.destroyViews();
        this.heals.clear();
        this.hits.clear();
        this.world.reset();
        this.syncViews();
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      setRaidCommands(null);
    });
    setHudState(this.world.hud());
  }

  update(_t: number, delta: number): void {
    this.drawBox();
    this.drawMovePreview();
    this.world.tick(delta);
    for (const fx of this.world.takeHeals()) this.heals.spawn(fx);
    this.heals.tick(delta, this.world.units);
    for (const fx of this.world.takeHits()) this.hits.spawn(fx);
    this.hits.tick(delta, this.world.units);
    this.syncViews();
    this.redrawUnits();
    setHudState(this.world.hud());
  }

  private drawField(): void {
    const g = this.add.graphics().setDepth(0);
    const dungeon = this.dungeon;
    const path = new Set(dungeon.path.map((p) => `${p.c},${p.r}`));
    g.fillStyle(0x12141a, 1);
    g.fillRect(0, 0, dungeon.cols * TILE, dungeon.rows * TILE);
    g.lineStyle(1, 0x1a2030, 0.55);
    for (let c = 0; c <= dungeon.cols; c++) {
      g.lineBetween(c * TILE, 0, c * TILE, dungeon.rows * TILE);
    }
    for (let r = 0; r <= dungeon.rows; r++) {
      g.lineBetween(0, r * TILE, dungeon.cols * TILE, r * TILE);
    }
    for (let r = 0; r < dungeon.rows; r++) {
      for (let c = 0; c < dungeon.cols; c++) {
        if (dungeon.blocked[r][c]) continue;
        const onPath = path.has(`${c},${r}`);
        const room = roomContaining(dungeon, c, r);
        if (room) {
          const fill = ROOM_FILL[room.size];
          g.fillStyle(onPath ? fill.path : fill.floor, 1);
        } else {
          g.fillStyle(onPath ? 0x35463a : 0x232a38, 1);
        }
        g.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }
    const boss = dungeon.boss;
    g.lineStyle(2, 0xd97706, 0.95);
    g.strokeRect(boss.c * TILE + 1, boss.r * TILE + 1, boss.w * TILE - 2, boss.h * TILE - 2);
    this.paintTile(g, dungeon.end, 0xa16207);
    drawPortal(g, dungeon.start);
    const bossLabel = gridCenter(roomCenter(boss), TILE);
    this.add
      .text(bossLabel.x, bossLabel.y, "BOSS", {
        fontSize: "12px",
        color: "#fbbf24",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(2);
  }

  private paintTile(g: Phaser.GameObjects.Graphics, p: { c: number; r: number }, color: number): void {
    g.fillStyle(color, 1);
    g.fillRect(p.c * TILE, p.r * TILE, TILE, TILE);
  }

  private syncViews(): void {
    const living = new Set(this.world.units.filter((u) => u.stats.health > 0).map((u) => u.id));
    for (const [id, view] of this.views) {
      if (!living.has(id)) {
        view.body.destroy();
        this.views.delete(id);
      }
    }
    for (const u of this.world.units) {
      if (u.stats.health <= 0) continue;
      if (!this.views.has(u.id)) this.views.set(u.id, this.makeView(u));
    }
  }

  private makeView(u: SimUnit): UnitView {
    const body = this.add.container(u.x, u.y).setDepth(5);
    const spriteLayers = appearanceFrames(u.appearance).map((frame) => this.makeSpriteLayer(frame));
    const ring = this.add.circle(0, 0, 18, 0x000000, 0).setStrokeStyle(2, 0xfef08a, 0);
    const hpBar = this.add.rectangle(0, -20, 22, 3, 0x22c55e).setOrigin(0.5);
    const manaBar = this.add.rectangle(0, -16, 22, 2, 0x38bdf8).setOrigin(0.5);
    manaBar.setVisible(canHeal(u) && u.stats.maxMana > 0);
    const label = this.add.text(0, 16, "", { fontSize: "9px", color: "#e5e7eb" }).setOrigin(0.5);
    body.add([...spriteLayers, ring, hpBar, manaBar, label]);
    return { id: u.id, body, ring, hpBar, manaBar, label };
  }

  private makeSpriteLayer(frame: SpriteFrame): Phaser.GameObjects.Image {
    return this.add
      .image(0, 0, CHARACTER_TEXTURE_KEY, frame.row * CHARACTER_COLUMNS + frame.col)
      .setOrigin(0.5)
      .setDisplaySize(TILE, TILE);
  }

  private destroyViews(): void {
    for (const view of this.views.values()) view.body.destroy();
    this.views.clear();
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

  private slotColor(u: SimUnit): number {
    if (u.role === "tank") return SLOT_COLORS.tank;
    if (u.role === "healer") return SLOT_COLORS.healer;
    return SLOT_COLORS.dps;
  }

  private clearPreview(): void {
    this.previewGfx.clear();
    for (const t of this.previewLabels) t.destroy();
    this.previewLabels = [];
  }

  private drawMovePreview(): void {
    this.clearPreview();
    if (!this.moveHeld) return;
    const p = this.input.activePointer;
    const command = this.world.commandAt(p.worldX, p.worldY);
    if (command) {
      const selected = this.world.units.filter((u) => u.selected && u.stats.health > 0);
      const color = command.kind === "heal" ? 0x4ade80 : 0xf87171;
      const title = this.add
        .text(command.x, command.y - 28, command.kind, { fontSize: "11px", color: command.kind === "heal" ? "#4ade80" : "#f87171" })
        .setOrigin(0.5)
        .setDepth(22);
      this.previewLabels.push(title);
      this.previewGfx.lineStyle(1, color, 0.95);
      this.previewGfx.strokeCircle(command.x, command.y, 16);
      for (const u of selected) {
        if (command.kind === "heal" && !canHeal(u)) continue;
        this.previewGfx.lineBetween(u.x, u.y, command.x, command.y);
      }
      return;
    }
    const assigns = this.world.moveAssignments(p.worldX, p.worldY);
    const name = this.world.formation;
    this.previewGfx.lineStyle(1, 0xfef08a, 0.85);
    this.previewGfx.strokeCircle(p.worldX, p.worldY, 5);
    const title = this.add
      .text(p.worldX, p.worldY - 28, name, { fontSize: "11px", color: "#fef08a" })
      .setOrigin(0.5)
      .setDepth(22);
    this.previewLabels.push(title);
    for (const { unit, goal, label } of assigns) {
      const color = this.slotColor(unit);
      this.previewGfx.lineStyle(1, color, 0.95);
      this.previewGfx.lineBetween(unit.x, unit.y, goal.x, goal.y);
      this.previewGfx.strokeCircle(goal.x, goal.y, 12);
      const tag = this.add
        .text(goal.x, goal.y, label, { fontSize: "10px", color: "#fff", fontStyle: "bold" })
        .setOrigin(0.5)
        .setDepth(22);
        this.previewLabels.push(tag);
    }
  }

  private redrawUnits(): void {
    for (const u of this.world.units) {
      if (u.stats.health <= 0) continue;
      const view = this.views.get(u.id);
      if (!view) continue;
      view.body.setPosition(u.x, u.y);
      view.ring.setStrokeStyle(2, 0xfef08a, u.selected ? 1 : 0);
      const hp = u.stats.health / u.stats.maxHealth;
      view.hpBar.width = 22 * hp;
      view.hpBar.fillColor = hp > 0.4 ? 0x22c55e : 0xef4444;
      if (u.stats.maxMana > 0) {
        view.manaBar.width = 22 * (u.stats.mana / u.stats.maxMana);
      }
      if (u.side === "enemy") {
        const t = enemyTarget(this.world.units, u);
        view.label.setText(t ? t.role.slice(0, 1) : "-");
      } else {
        view.label.setText(isRanged(u.stats) ? "R" : "M");
      }
    }
  }
}
