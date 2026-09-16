import { useSyncExternalStore } from "react";
import { DungeonCanvas } from "../DungeonCanvas";
import type { DungeonEncounter } from "../sim/dungeonWorld";
import type { GroupMember } from "../sim/group";
import { getDungeonCommands } from "../view/dungeonCommands";
import { getDungeonHudState, subscribeDungeonHud } from "../view/dungeonHudStore";

const PACK_SIZES = [2, 3, 4, 5];

export function DungeonScreen({
  group,
  encounter,
  onLeave,
  onStartGame,
}: {
  group: GroupMember[];
  encounter?: DungeonEncounter;
  onLeave: () => void;
  onStartGame: (encounter: DungeonEncounter) => void;
}) {
  const hud = useSyncExternalStore(subscribeDungeonHud, getDungeonHudState, getDungeonHudState);
  const commands = getDungeonCommands();

  return (
    <div className="app">
      <aside className="hud">
        <h1>Dungeon</h1>
        <p className="hint">
          Small, medium, and big rooms linked by corridors, ending in a boss chamber on the east
          side. The boss links to only one other room. The mossy tiles are a guaranteed walk from
          start (S) to the boss. Left click a free floor tile to stamp an enemy pack. Right click a
          pack to remove it. No raid group in this scene.
        </p>
        <div className="row">
          <button type="button" onClick={() => commands?.regenerate()}>
            Generate
          </button>
          <button type="button" onClick={() => commands?.clearGroups()}>
            Clear packs
          </button>
          <button type="button" onClick={() => commands?.startGame()}>
            Start game
          </button>
          <button type="button" onClick={onLeave}>
            Leave dungeon
          </button>
        </div>
        <h2>Pack size</h2>
        <div className="row-inline">
          {PACK_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={hud.packSize === size ? "is-active" : undefined}
              onClick={() => commands?.setPackSize(size)}
            >
              {size}
            </button>
          ))}
        </div>
        <p>
          Seed {hud.seed} · {hud.smallRooms} small · {hud.mediumRooms} med · {hud.bigRooms} big ·
          boss
        </p>
        <p>Group {group.length} units · path {hud.pathLength} tiles</p>
        <p>
          Packs {hud.groupCount} · enemies {hud.enemyAlive}
        </p>
        <p className="legend">
          Packs sit on floor tiles only. Start and the boss tile stay clear so the route remains
          readable. Dark rooms are small, mid-blue medium, pale big, wine-red is the boss.
        </p>
      </aside>
      <DungeonCanvas encounter={encounter} onStartGame={onStartGame} />
    </div>
  );
}
