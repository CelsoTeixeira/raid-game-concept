import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { DungeonEncounter } from "./sim/dungeonWorld";
import type { GroupMember } from "./sim/group";
import { RaidScene } from "./view/RaidScene";

export function GameCanvas({
  group,
  encounter,
}: {
  group: GroupMember[];
  encounter: DungeonEncounter;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      backgroundColor: "#1a1f16",
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.RESIZE },
    });
    game.scene.add("raid", RaidScene, false);
    game.scene.start("raid", { group, encounter });
    return () => {
      game.destroy(true);
    };
  }, []);

  return <div ref={host} className="field-canvas-host" />;
}
