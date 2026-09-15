import Phaser from "phaser";
import type { HealFx } from "../sim/combat";
import type { SimUnit } from "../sim/unit";

const BOLT_MS = 280;
const TEXT_MS = 1000;
const GREEN = 0x4ade80;

type Bolt = {
  dot: Phaser.GameObjects.Arc;
  fromX: number;
  fromY: number;
  targetId: string;
  amount: number;
  elapsed: number;
};

/**
 * Green heal orb flies to the target, then `+N` floats up for 1s.
 * Bolt homes on the live unit so the land matches a moving raid.
 */
export class HealFxLayer {
  private bolts: Bolt[] = [];

  constructor(private scene: Phaser.Scene) {}

  spawn(fx: HealFx): void {
    const dot = this.scene.add.circle(fx.fromX, fx.fromY, 5, GREEN, 1).setDepth(18);
    this.bolts.push({
      dot,
      fromX: fx.fromX,
      fromY: fx.fromY,
      targetId: fx.targetId,
      amount: fx.amount,
      elapsed: 0,
    });
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

  private floatText(x: number, y: number, amount: number): void {
    const label = this.scene.add
      .text(x, y, `+${amount}`, {
        fontSize: "13px",
        color: "#4ade80",
        fontStyle: "bold",
        stroke: "#14532d",
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
