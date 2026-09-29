import { useState, useSyncExternalStore } from "react";
import { GameCanvas } from "../GameCanvas";
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
  const [panelOpen, setPanelOpen] = useState(false);

  const run = (fn: keyof NonNullable<ReturnType<typeof getRaidCommands>>) => {
    getRaidCommands()?.[fn]();
  };

  return (
    <div className="app field-app">
      <div className={`field-sidebar${panelOpen ? "" : " is-collapsed"}`}>
        <div className="field-controls">
          <button type="button" onClick={() => setPanelOpen((open) => !open)}>
            {panelOpen ? "Hide panel" : "Test panel"}
          </button>
          <button type="button" onClick={onLeave}>
            Leave field
          </button>
        </div>
        {panelOpen && (
          <aside className="hud">
            <h1>Raid POC</h1>
            <p className="hint">
              Left click select. Drag box. Shift add. Hold right click: on empty ground, preview a
              formation move and release to go. On an enemy, attack (walk in only if out of range);
              that enemy then pursues. Idle enemies stay put until a friendly is close, they take a
              hit, or a packmate is already fighting. On a friendly, units with healing gear heal
              that ally (same range rule); everyone else keeps the ground-move. A ground move cancels
              the attack/heal order. While previewing a move: F or mouse wheel cycles formation (raid
              / line / box). 1 raid, 2 line, 3 box. Tank role at the click, melee reach behind, ranged
              reach at the back. Labels: T tank, Dm/Dr dps, Hm/Hr healer. Camera: wheel zooms (except
              while previewing a move), WASD/arrows pan, move to an edge to scroll, middle drag pans,
              and hold Space to center on and follow the selection.
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
                    {u.role} {u.ranged ? "ranged" : "melee"} hp {u.health}/{u.maxHealth}
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
              Group sprites use layered character art and equipped gear. Green body enemies. Melee
              swings only from the next tile. M melee / R ranged under friendlies.
            </p>
          </aside>
        )}
      </div>
      <GameCanvas group={group} encounter={encounter} />
    </div>
  );
}
