import Phaser from "phaser";
import type { HitFx } from "../sim/combat";
import type { SimUnit } from "../sim/unit";

const BOLT_MS = 280;
const SLASH_MS = 140;
const TEXT_MS = 1000;
const RED = 0xef4444;
const GOLD = 0xeab308;

type Bolt = {
  dot: Phaser.GameObjects.Arc;
  fromX: number;
  fromY: number;
  targetId: string;
  amount: number;
  elapsed: number;
};

/**
 * Melee: short slash toward the target, then `-N`.
 * Ranged DPS: gold bolt, then `-N`.
 */
export class HitFxLayer {
  private bolts: Bolt[] = [];

  constructor(private scene: Phaser.Scene) {}

  spawn(fx: HitFx): void {
    if (fx.kind === "ranged") {
      const dot = this.scene.add.circle(fx.fromX, fx.fromY, 4, GOLD, 1).setDepth(18);
      this.bolts.push({
        dot,
        fromX: fx.fromX,
        fromY: fx.fromY,
        targetId: fx.targetId,
        amount: fx.amount,
        elapsed: 0,
      });
      return;
    }
    this.slash(fx);
  }

  tick(delta: number, units: SimUnit[]): void {
    const live = new Map(units.filter((u) => u.stats.health > 0).map((u) => [u.id, u]));
    const keep: Bolt[] = [];
    for (const bolt of this.bolts) {
      bolt.elapsed += delta;
      const target = live.get(bolt.targetId);
      const toX = target?.x ?? bolt.dot.x;
      const toY = target?.y ?? bolt.dot.y;
      const t = Math.min(1, bolt.elapsed / BOLT_MS);
      bolt.dot.setPosition(
        bolt.fromX + (toX - bolt.fromX) * t,
        bolt.fromY + (toY - bolt.fromY) * t,
      );
      if (t < 1) {
        keep.push(bolt);
        continue;
      }
      bolt.dot.destroy();
      this.floatText(toX, toY - 18, bolt.amount);
    }
    this.bolts = keep;
  }

  clear(): void {
    for (const bolt of this.bolts) bolt.dot.destroy();
    this.bolts = [];
  }

  private slash(fx: HitFx): void {
    const g = this.scene.add.graphics().setDepth(18);
    g.lineStyle(3, RED, 0.95);
    const dx = fx.toX - fx.fromX;
    const dy = fx.toY - fx.fromY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const startX = fx.fromX + nx * 10;
    const startY = fx.fromY + ny * 10;
    const endX = fx.toX - nx * 8;
    const endY = fx.toY - ny * 8;
    g.lineBetween(startX, startY, endX, endY);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: SLASH_MS,
      onComplete: () => g.destroy(),
    });
    this.floatText(fx.toX, fx.toY - 18, fx.amount);
  }

  private floatText(x: number, y: number, amount: number): void {
    const label = this.scene.add
      .text(x, y, `-${amount}`, {
        fontSize: "13px",
        color: "#fecaca",
        fontStyle: "bold",
        stroke: "#7f1d1d",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(22);
    this.scene.tweens.add({
      targets: label,
      y: y - 36,
      alpha: 0,
      duration: TEXT_MS,
      ease: "Sine.easeOut",
      onComplete: () => label.destroy(),
    });
  }
}
