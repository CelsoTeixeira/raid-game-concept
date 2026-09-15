import Phaser from "phaser";
import { COLS, ROWS, TILE } from "../sim/balance";
import { enemyTarget } from "../sim/combat";
import { gridCenter } from "../sim/grid";
import { WALLS } from "../sim/map";
import type { SimUnit } from "../sim/unit";
import { World } from "../sim/world";
import { setRaidCommands } from "./commands";
import { makeForm } from "./forms";
import { HealFxLayer } from "./healFx";
import { setHudState } from "./hudStore";

type UnitView = {
  id: string;
  body: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Arc;
  hpBar: Phaser.GameObjects.Rectangle;
  manaBar: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

/**
 * Phaser adapter: input, forms, HUD. All rules live in {@link World}.
 * Hold RMB to preview landings (`moveAssignments`); release to `orderMove`.
 */
export class RaidScene extends Phaser.Scene {
  private world = new World();
  private views = new Map<string, UnitView>();
  private boxStart: Phaser.Math.Vector2 | null = null;
  private boxGfx!: Phaser.GameObjects.Graphics;
  private previewGfx!: Phaser.GameObjects.Graphics;
  private heals = new HealFxLayer(this);
  private moveHeld = false;
  private shift = false;

  constructor() {
    super("raid");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x1a1f16);
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
        if (this.moveHeld) this.world.orderMove(p.worldX, p.worldY);
        this.moveHeld = false;
        this.previewGfx.clear();
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
    this.syncViews();
    this.redrawUnits();
    setHudState(this.world.hud());
  }

  private drawField(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x24301c, 1);
    g.fillRect(0, 0, COLS * TILE, ROWS * TILE);
    g.lineStyle(1, 0x2f3d24, 0.5);
    for (let c = 0; c <= COLS; c++) g.lineBetween(c * TILE, 0, c * TILE, ROWS * TILE);
    for (let r = 0; r <= ROWS; r++) g.lineBetween(0, r * TILE, COLS * TILE, r * TILE);
    g.fillStyle(0x4b5563, 1);
    for (const [c, r, w, h] of WALLS) {
      g.fillRect(c * TILE, r * TILE, w * TILE, h * TILE);
    }
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
    const shape = makeForm(this, u.side, u.role);
    const ring = this.add.circle(0, 0, 18, 0x000000, 0).setStrokeStyle(2, 0xfef08a, 0);
    const hpBar = this.add.rectangle(0, -20, 22, 3, 0x22c55e).setOrigin(0.5);
    const manaBar = this.add.rectangle(0, -16, 22, 2, 0x38bdf8).setOrigin(0.5);
    manaBar.setVisible(u.stats.maxMana > 0);
    const label = this.add.text(0, 16, "", { fontSize: "9px", color: "#e5e7eb" }).setOrigin(0.5);
    body.add([ring, shape, hpBar, manaBar, label]);
    return { id: u.id, body, ring, hpBar, manaBar, label };
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

  private drawMovePreview(): void {
    this.previewGfx.clear();
    if (!this.moveHeld) return;
    const p = this.input.activePointer;
    this.previewGfx.lineStyle(1, 0xffffff, 0.95);
    for (const { unit, goal } of this.world.moveAssignments(p.worldX, p.worldY)) {
      const dest = gridCenter(goal, TILE);
      this.previewGfx.lineBetween(unit.x, unit.y, dest.x, dest.y);
      this.previewGfx.strokeCircle(dest.x, dest.y, TILE * 0.42);
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
        view.label.setText(u.rangeType === "ranged" ? "R" : "M");
      }
    }
  }
}
