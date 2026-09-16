import type { DungeonHudState } from "../sim/dungeonWorld";

const empty: DungeonHudState = {
  seed: 0,
  rooms: 0,
  smallRooms: 0,
  mediumRooms: 0,
  bigRooms: 0,
  pathLength: 0,
  packSize: 3,
  groupCount: 0,
  enemyAlive: 0,
};

let state: DungeonHudState = empty;
const listeners = new Set<() => void>();

export function getDungeonHudState(): DungeonHudState {
  return state;
}

export function setDungeonHudState(next: DungeonHudState): void {
  state = next;
  for (const l of listeners) l();
}

export function subscribeDungeonHud(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
