import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { COLS, ROWS, TILE } from "./sim/balance";
import { RaidScene } from "./view/RaidScene";

export function GameCanvas() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: COLS * TILE,
      height: ROWS * TILE,
      backgroundColor: "#1a1f16",
      scene: [RaidScene],
      audio: { noAudio: true },
    });
    return () => {
      game.destroy(true);
    };
  }, []);

  return <div ref={host} className="canvas-host" />;
}
