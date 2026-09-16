import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { DungeonScene } from "./view/DungeonScene";

export function DungeonCanvas() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: 960,
      height: 640,
      backgroundColor: "#12141a",
      audio: { noAudio: true },
    });
    game.scene.add("dungeon", DungeonScene, true);
    return () => {
      game.destroy(true);
    };
  }, []);

  return <div ref={host} className="canvas-host" />;
}
