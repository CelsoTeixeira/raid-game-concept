import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { COLS, ROWS, TILE } from "./sim/balance";
import type { GroupMember } from "./sim/group";
import { RaidScene } from "./view/RaidScene";

export function GameCanvas({ group }: { group: GroupMember[] }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: COLS * TILE,
      height: ROWS * TILE,
      backgroundColor: "#1a1f16",
      audio: { noAudio: true },
    });
    game.scene.add("raid", RaidScene, false);
    game.scene.start("raid", { group });
    return () => {
      game.destroy(true);
    };
  }, []);

  return <div ref={host} className="canvas-host" />;
}
