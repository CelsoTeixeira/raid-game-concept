import Phaser from "phaser";

const ZOOM_STEP = 1.15;
const DEFAULT_FIELD_ZOOM = 1.65;
const MAX_ZOOM = 4;
const ZOOM_EASE_RATE = 12;
const PAN_SCREEN_SPEED = 500;
const EDGE_MARGIN = 24;

type CameraKeys = Record<string, Phaser.Input.Keyboard.Key>;

export class CameraController {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly keys: CameraKeys;
  private fitZoom: number;
  private targetZoom: number;
  private zoomAnchor: { x: number; y: number; worldX: number; worldY: number } | null = null;
  private dragAnchor: { worldX: number; worldY: number } | null = null;
  private pointerInside = false;
  private readonly onWheel: (pointer: Phaser.Input.Pointer, over: unknown, dx: number, dy: number) => void;
  private readonly onPointerDown: (pointer: Phaser.Input.Pointer) => void;
  private readonly onPointerMove: (pointer: Phaser.Input.Pointer) => void;
  private readonly onPointerUp: (pointer: Phaser.Input.Pointer) => void;
  private readonly onGameOut: () => void;
  private readonly onGameOver: () => void;
  private readonly onShutdown: () => void;
  private readonly onResize: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldW: number,
    private readonly worldH: number,
    spawnFocus: { x: number; y: number },
    private readonly getSelectionFocus: () => { x: number; y: number } | null,
    private readonly isZoomBlocked: () => boolean,
  ) {
    this.camera = scene.cameras.main;
    this.fitZoom = this.calculateFitZoom();
    this.camera.setBounds(0, 0, worldW, worldH);
    this.targetZoom = this.clampZoom(DEFAULT_FIELD_ZOOM);
    this.camera.setZoom(this.targetZoom);
    this.camera.centerOn(spawnFocus.x, spawnFocus.y);
    this.onResize = () => {
      this.fitZoom = this.calculateFitZoom();
      this.targetZoom = this.clampZoom(this.targetZoom);
      this.camera.setZoom(this.clampZoom(this.camera.zoom));
      this.zoomAnchor = null;
    };

    this.keys = scene.input.keyboard?.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE",
      true,
    ) as CameraKeys;

    this.onWheel = (pointer, _over, _dx, dy) => {
      if (this.isZoomBlocked() || dy === 0) return;
      pointer.updateWorldPoint(this.camera);
      const nextZoom = Phaser.Math.Clamp(
        this.targetZoom * (dy < 0 ? ZOOM_STEP : 1 / ZOOM_STEP),
        this.fitZoom,
        this.getMaxZoom(),
      );
      if (nextZoom === this.targetZoom) return;
      this.targetZoom = nextZoom;
      this.zoomAnchor = {
        x: pointer.x,
        y: pointer.y,
        worldX: pointer.worldX,
        worldY: pointer.worldY,
      };
    };
    this.onPointerDown = (pointer) => {
      if (!pointer.middleButtonDown()) return;
      pointer.updateWorldPoint(this.camera);
      this.dragAnchor = { worldX: pointer.worldX, worldY: pointer.worldY };
    };
    this.onPointerMove = (pointer) => {
      this.pointerInside = this.isInsideCanvas(pointer);
      if (!this.dragAnchor) return;
      pointer.updateWorldPoint(this.camera);
      this.setScrollForAnchor(this.dragAnchor.worldX, this.dragAnchor.worldY, pointer.x, pointer.y);
    };
    this.onPointerUp = (pointer) => {
      if (pointer.button === 1) this.dragAnchor = null;
    };
    this.onGameOut = () => {
      this.pointerInside = false;
    };
    this.onGameOver = () => {
      this.pointerInside = true;
    };
    this.onShutdown = () => this.destroy();

    scene.input.on("wheel", this.onWheel);
    scene.input.on("pointerdown", this.onPointerDown);
    scene.input.on("pointermove", this.onPointerMove);
    scene.input.on("pointerup", this.onPointerUp);
    scene.input.on("gameout", this.onGameOut);
    scene.input.on("gameover", this.onGameOver);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);
    scene.scale.on("resize", this.onResize);
  }

  private calculateFitZoom(): number {
    return Math.min(this.scene.scale.width / this.worldW, this.scene.scale.height / this.worldH);
  }

  private getMaxZoom(): number {
    return Math.max(this.fitZoom, MAX_ZOOM);
  }

  private clampZoom(zoom: number): number {
    return Phaser.Math.Clamp(zoom, this.fitZoom, this.getMaxZoom());
  }

  update(delta: number): void {
    const deltaSeconds = Math.max(0, delta) / 1000;
    this.easeZoom(deltaSeconds);

    const space = this.keys.SPACE;
    if (space.isDown) {
      const focus = this.getSelectionFocus();
      if (focus) this.camera.centerOn(focus.x, focus.y);
    } else if (!this.dragAnchor) {
      this.pan(deltaSeconds);
    }

    this.scene.input.activePointer.updateWorldPoint(this.camera);
  }

  private easeZoom(deltaSeconds: number): void {
    if (this.camera.zoom === this.targetZoom) return;
    const amount = 1 - Math.exp(-ZOOM_EASE_RATE * deltaSeconds);
    const zoom = this.camera.zoom + (this.targetZoom - this.camera.zoom) * amount;
    this.camera.setZoom(zoom);

    if (this.zoomAnchor) {
      this.setScrollForAnchor(
        this.zoomAnchor.worldX,
        this.zoomAnchor.worldY,
        this.zoomAnchor.x,
        this.zoomAnchor.y,
      );
    }

    if (Math.abs(this.targetZoom - zoom) < 0.0001) {
      this.camera.setZoom(this.targetZoom);
      this.zoomAnchor = null;
    }
  }

  private pan(deltaSeconds: number): void {
    let x = Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown);
    let y = Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown);

    if (this.pointerInside) {
      const pointer = this.scene.input.activePointer;
      if (pointer.x < EDGE_MARGIN) x -= (EDGE_MARGIN - pointer.x) / EDGE_MARGIN;
      else if (pointer.x > this.camera.width - EDGE_MARGIN) {
        x += (pointer.x - (this.camera.width - EDGE_MARGIN)) / EDGE_MARGIN;
      }
      if (pointer.y < EDGE_MARGIN) y -= (EDGE_MARGIN - pointer.y) / EDGE_MARGIN;
      else if (pointer.y > this.camera.height - EDGE_MARGIN) {
        y += (pointer.y - (this.camera.height - EDGE_MARGIN)) / EDGE_MARGIN;
      }
    }

    const magnitude = Math.hypot(x, y);
    if (magnitude === 0) return;
    const distance = (PAN_SCREEN_SPEED * deltaSeconds) / this.camera.zoom;
    this.camera.setScroll(
      this.camera.scrollX + (x / magnitude) * distance,
      this.camera.scrollY + (y / magnitude) * distance,
    );
  }

  private setScrollForAnchor(worldX: number, worldY: number, screenX: number, screenY: number): void {
    const originX = this.camera.width * this.camera.originX;
    const originY = this.camera.height * this.camera.originY;
    this.camera.setScroll(
      worldX - originX - (screenX - this.camera.x - originX) / this.camera.zoom,
      worldY - originY - (screenY - this.camera.y - originY) / this.camera.zoom,
    );
  }

  private isInsideCanvas(pointer: Phaser.Input.Pointer): boolean {
    return pointer.x >= 0 && pointer.y >= 0 && pointer.x <= this.camera.width && pointer.y <= this.camera.height;
  }

  private destroy(): void {
    this.scene.input.off("wheel", this.onWheel);
    this.scene.input.off("pointerdown", this.onPointerDown);
    this.scene.input.off("pointermove", this.onPointerMove);
    this.scene.input.off("pointerup", this.onPointerUp);
    this.scene.input.off("gameout", this.onGameOut);
    this.scene.input.off("gameover", this.onGameOver);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);
    this.scene.scale.off("resize", this.onResize);
    this.scene.input.keyboard?.removeKey(this.keys.W, true);
    this.scene.input.keyboard?.removeKey(this.keys.A, true);
    this.scene.input.keyboard?.removeKey(this.keys.S, true);
    this.scene.input.keyboard?.removeKey(this.keys.D, true);
    this.scene.input.keyboard?.removeKey(this.keys.UP, true);
    this.scene.input.keyboard?.removeKey(this.keys.DOWN, true);
    this.scene.input.keyboard?.removeKey(this.keys.LEFT, true);
    this.scene.input.keyboard?.removeKey(this.keys.RIGHT, true);
    this.scene.input.keyboard?.removeKey(this.keys.SPACE, true);
  }
}
