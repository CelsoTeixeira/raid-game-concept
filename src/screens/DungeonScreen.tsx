import { useSyncExternalStore } from "react";
import { DungeonCanvas } from "../DungeonCanvas";
import type { MapSize } from "../sim/dungeon";
import type { DungeonEncounter } from "../sim/dungeonWorld";
import type { GroupMember } from "../sim/group";
import { getDungeonCommands } from "../view/dungeonCommands";
import { getDungeonHudState, subscribeDungeonHud } from "../view/dungeonHudStore";

const PACK_SIZES = [2, 3, 4, 5];
const MAP_SIZES: MapSize[] = ["small", "medium", "big"];

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
          Rooms linked by corridors, from the entry portal to a goal room on a random side. Big maps
          end in a boss chamber; small and medium maps end in an exit portal. Ordinary rooms seed
          several enemy packs with space between them so a pull does not grab the whole room. Left
          click a free floor tile to stamp an extra pack. Right click a pack to remove it. No raid
          group in this scene.
        </p>
        <h2>Map size</h2>
        <div className="row-inline">
          {MAP_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={hud.mapSize === size ? "is-active" : undefined}
              onClick={() => commands?.setMapSize(size)}
            >
              {size}
            </button>
          ))}
        </div>
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
          Seed {hud.seed} · {hud.mapSize} map · {hud.smallRooms} small · {hud.mediumRooms} med ·{" "}
          {hud.bigRooms} big · {hud.goal}
        </p>
        <p>Group {group.length} units · path {hud.pathLength} tiles</p>
        <p>
          Packs {hud.groupCount} · enemies {hud.enemyAlive}
        </p>
        <p className="legend">
          Packs sit on floor tiles only. The entry portal and the goal tile stay clear so the route
          remains readable. Dark rooms are small, mid-blue medium, pale big, wine-red is the boss,
          teal is the exit.
        </p>
      </aside>
      <DungeonCanvas encounter={encounter} onStartGame={onStartGame} />
    </div>
  );
}
