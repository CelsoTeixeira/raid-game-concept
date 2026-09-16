import { useSyncExternalStore } from "react";
import { GameCanvas } from "../GameCanvas";
import { kitLabel } from "../sim/classes";
import type { DungeonEncounter } from "../sim/dungeonWorld";
import type { GroupMember } from "../sim/group";
import { getRaidCommands } from "../view/commands";
import { getHudState, subscribeHud } from "../view/hudStore";

export function FieldScreen({
  group,
  encounter,
  onLeave,
}: {
  group: GroupMember[];
  encounter: DungeonEncounter;
  onLeave: () => void;
}) {
  const hud = useSyncExternalStore(subscribeHud, getHudState, getHudState);

  const run = (fn: keyof NonNullable<ReturnType<typeof getRaidCommands>>) => {
    getRaidCommands()?.[fn]();
  };

  return (
    <div className="app">
      <aside className="hud">
        <h1>Raid POC</h1>
        <p className="hint">
          Left click select. Drag box. Shift add. Hold right click: on empty ground, preview a
          formation move and release to go. On an enemy, attack (walk in only if out of range). On a
          friendly, healers heal that ally (same range rule); tanks and dps keep the ground-move.
          A ground move cancels the attack/heal order. While previewing a move: F or mouse wheel
          cycles formation (raid / line / box). 1 raid, 2 line, 3 box. Tanks at the click, melee
          behind, ranged at the back. Labels: T tank, Dm/Dr dps, Hm/Hr healer.
        </p>
        <div className="row">
          <button type="button" onClick={() => run("spawnEnemy")}>
            Spawn enemy
          </button>
          <button type="button" onClick={() => run("toggleAutoAttack")}>
            Toggle auto-attack
          </button>
          <button type="button" onClick={() => run("reset")}>
            Reset
          </button>
          <button type="button" onClick={onLeave}>
            Leave field
          </button>
        </div>
        <p>
          Alive {hud.friendlyAlive} / enemies {hud.enemyAlive} · formation {hud.formation}
        </p>
        <h2>Selected</h2>
        {hud.selected.length === 0 ? (
          <p className="muted">None</p>
        ) : (
          <ul>
            {hud.selected.map((u) => (
              <li key={u.id}>
                {kitLabel(u.unitClass, u.subclass) ?? `${u.role} ${u.rangeType}`} hp {u.health}/{u.maxHealth}
                {u.maxMana > 0 ? ` mana ${u.mana}/${u.maxMana}` : ""} aa {u.autoAttack ? "on" : "off"}
              </li>
            ))}
          </ul>
        )}
        <h2>Threat (debug)</h2>
        {hud.threatLines.length === 0 ? (
          <p className="muted">No enemies</p>
        ) : (
          <ul>
            {hud.threatLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <p className="legend">
          Group sprites use the organizer appearance. Green body enemies. Melee swings only from
          the next tile. M melee / R ranged under friendlies.
        </p>
      </aside>
      <GameCanvas group={group} encounter={encounter} />
    </div>
  );
}
