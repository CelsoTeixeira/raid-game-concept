import Phaser from "phaser";
import { appearanceFrames, type SpriteFrame } from "../appearance";
import { TILE } from "../sim/balance";
import { roomCenter, roomContaining, type RoomSize } from "../sim/dungeon";
import { DungeonWorld, type DungeonEncounter } from "../sim/dungeonWorld";
import { gridCenter } from "../sim/grid";
import type { SimUnit } from "../sim/unit";
import { setDungeonCommands } from "./dungeonCommands";
import { setDungeonHudState } from "./dungeonHudStore";
import { drawPortal } from "./portal";

const CHARACTER_TEXTURE_KEY = "character-sheet";
const CHARACTER_SHEET_URL = new URL("../assets/roguelikeChar_transparent.png", import.meta.url).href;
const CHARACTER_CELL_SIZE = 16;
const CHARACTER_COLUMNS = 54;
const ROOM_FILL: Record<RoomSize, { floor: number; path: number }> = {
  small: { floor: 0x243044, path: 0x354a44 },
  medium: { floor: 0x2a3344, path: 0x3f5344 },
  big: { floor: 0x364155, path: 0x455a4c },
  boss: { floor: 0x4a2730, path: 0x5c3d32 },
  exit: { floor: 0x16333a, path: 0x1f4a45 },
};

type UnitView = {
  id: string;
  body: Phaser.GameObjects.Container;
  hpBar: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

/** Phaser adapter for the dungeon sandbox: stamp packs onto a generated floor. */
export class DungeonScene extends Phaser.Scene {
  private world!: DungeonWorld;
  private onStartGame!: (encounter: DungeonEncounter) => void;
  private views = new Map<string, UnitView>();
  private mapGfx!: Phaser.GameObjects.Graphics;
  private previewGfx!: Phaser.GameObjects.Graphics;
  private groupGfx!: Phaser.GameObjects.Graphics;
  private marks: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("dungeon");
  }

  init(data: { encounter?: DungeonEncounter; onStartGame: (encounter: DungeonEncounter) => void }): void {
    this.world = new DungeonWorld(data.encounter);
    this.onStartGame = data.onStartGame;
  }

  preload(): void {
    this.load.spritesheet(CHARACTER_TEXTURE_KEY, CHARACTER_SHEET_URL, {
      frameWidth: CHARACTER_CELL_SIZE,
      frameHeight: CHARACTER_CELL_SIZE,
      spacing: 1,
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x12141a);
    this.cameras.main.roundPixels = true;
    this.fitCamera();
    this.mapGfx = this.add.graphics().setDepth(0);
    this.groupGfx = this.add.graphics().setDepth(3);
    this.previewGfx = this.add.graphics().setDepth(12);
    this.input.mouse?.disableContextMenu();
    this.redrawMap();
    this.syncViews();
    this.drawGroups();

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (p.button === 2) {
        this.world.removeGroupAt(p.worldX, p.worldY);
        this.syncViews();
        this.drawGroups();
        return;
      }
      if (p.button !== 0) return;
      this.world.placeGroup(p.worldX, p.worldY);
      this.syncViews();
      this.drawGroups();
    });

    setDungeonCommands({
      regenerate: () => {
        this.world.regenerate();
        this.destroyViews();
        this.fitCamera();
        this.redrawMap();
        this.drawGroups();
      },
      setMapSize: (size) => {
        this.world.setMapSize(size);
        this.destroyViews();
        this.fitCamera();
        this.redrawMap();
        this.drawGroups();
      },
      clearGroups: () => {
        this.world.clearGroups();
        this.destroyViews();
        this.drawGroups();
      },
      setPackSize: (n) => {
        this.world.setPackSize(n);
      },
      startGame: () => {
        this.onStartGame(this.world.encounter());
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      setDungeonCommands(null);
    });
    setDungeonHudState(this.world.hud());
  }

  update(): void {
    this.drawPreview();
    this.syncViews();
    this.redrawUnits();
    setDungeonHudState(this.world.hud());
  }

  /** Map size and north/south portrait grids change the fit on every regenerate. */
  private fitCamera(): void {
    const worldW = this.world.dungeon.cols * TILE;
    const worldH = this.world.dungeon.rows * TILE;
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setZoom(Math.min(this.scale.width / worldW, this.scale.height / worldH));
    this.cameras.main.centerOn(worldW / 2, worldH / 2);
  }

  private redrawMap(): void {
    this.mapGfx.clear();
    for (const t of this.marks) t.destroy();
    this.marks = [];
    const dungeon = this.world.dungeon;
    const path = new Set(dungeon.path.map((p) => `${p.c},${p.r}`));
    this.mapGfx.fillStyle(0x12141a, 1);
    this.mapGfx.fillRect(0, 0, dungeon.cols * TILE, dungeon.rows * TILE);
    this.mapGfx.lineStyle(1, 0x1a2030, 0.55);
    for (let c = 0; c <= dungeon.cols; c++) {
      this.mapGfx.lineBetween(c * TILE, 0, c * TILE, dungeon.rows * TILE);
    }
    for (let r = 0; r <= dungeon.rows; r++) {
      this.mapGfx.lineBetween(0, r * TILE, dungeon.cols * TILE, r * TILE);
    }
    for (let r = 0; r < dungeon.rows; r++) {
      for (let c = 0; c < dungeon.cols; c++) {
        if (dungeon.blocked[r][c]) continue;
        const onPath = path.has(`${c},${r}`);
        const room = roomContaining(dungeon, c, r);
        if (room) {
          const fill = ROOM_FILL[room.size];
          this.mapGfx.fillStyle(onPath ? fill.path : fill.floor, 1);
        } else {
          this.mapGfx.fillStyle(onPath ? 0x35463a : 0x232a38, 1);
        }
        this.mapGfx.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }
    drawPortal(this.mapGfx, dungeon.start, "entry");
    const goal = dungeon.goal;
    if (goal.size !== "boss") {
      drawPortal(this.mapGfx, dungeon.end, "exit");
      return;
    }
    this.mapGfx.lineStyle(2, 0xd97706, 0.95);
    this.mapGfx.strokeRect(goal.c * TILE + 1, goal.r * TILE + 1, goal.w * TILE - 2, goal.h * TILE - 2);
    this.paintTile(dungeon.end, 0xa16207);
    const bossLabel = gridCenter(roomCenter(goal), TILE);
    this.marks.push(
      this.add
        .text(bossLabel.x, bossLabel.y, "BOSS", { fontSize: "12px", color: "#fbbf24", fontStyle: "bold" })
        .setOrigin(0.5)
        .setDepth(2),
    );
  }

  private paintTile(p: { c: number; r: number }, color: number): void {
    this.mapGfx.fillStyle(color, 1);
    this.mapGfx.fillRect(p.c * TILE, p.r * TILE, TILE, TILE);
  }

  private drawPreview(): void {
    this.previewGfx.clear();
    const p = this.input.activePointer;
    const tiles = this.world.previewTiles(p.worldX, p.worldY);
    if (tiles.length === 0) return;
    this.previewGfx.lineStyle(1, 0xf87171, 0.95);
    this.previewGfx.fillStyle(0xf87171, 0.22);
    for (const tile of tiles) {
      const { x, y } = gridCenter(tile, TILE);
      this.previewGfx.fillCircle(x, y, 12);
      this.previewGfx.strokeCircle(x, y, 12);
    }
  }

  private drawGroups(): void {
    this.groupGfx.clear();
    this.groupGfx.lineStyle(1, 0xf87171, 0.45);
    for (const group of this.world.groups) {
      const members = group.unitIds
        .map((id) => this.world.units.find((u) => u.id === id))
        .filter((u): u is SimUnit => !!u && u.stats.health > 0);
      if (members.length === 0) continue;
      const cx = members.reduce((s, u) => s + u.x, 0) / members.length;
      const cy = members.reduce((s, u) => s + u.y, 0) / members.length;
      const radius = Math.max(22, ...members.map((u) => Math.hypot(u.x - cx, u.y - cy))) + 14;
      this.groupGfx.strokeCircle(cx, cy, radius);
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
    const groupIndex = this.world.groups.findIndex((g) => g.unitIds.includes(u.id));
    const body = this.add.container(u.x, u.y).setDepth(5);
    const spriteLayers = u.sprite.kind === "kenney"
      ? appearanceFrames(u.sprite.appearance).map((frame) => this.makeSpriteLayer(frame))
      : [];
    const hpBar = this.add.rectangle(0, -20, 22, 3, 0x22c55e).setOrigin(0.5);
    const label = this.add
      .text(0, 16, groupIndex >= 0 ? `G${groupIndex + 1}` : "G", { fontSize: "9px", color: "#fecaca" })
      .setOrigin(0.5);
    body.add([...spriteLayers, hpBar, label]);
    return { id: u.id, body, hpBar, label };
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

  private redrawUnits(): void {
    for (const u of this.world.units) {
      if (u.stats.health <= 0) continue;
      const view = this.views.get(u.id);
      if (!view) continue;
      view.body.setPosition(u.x, u.y);
      const hp = u.stats.health / u.stats.maxHealth;
      view.hpBar.width = 22 * hp;
      const groupIndex = this.world.groups.findIndex((g) => g.unitIds.includes(u.id));
      view.label.setText(groupIndex >= 0 ? `G${groupIndex + 1}` : "G");
    }
  }
}
