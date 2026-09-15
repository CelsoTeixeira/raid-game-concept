import type { HudState } from "../sim/types";

/** Last `World.hud()` snapshot. React subscribes; the scene writes each frame. */
const empty: HudState = {
  selected: [],
  friendlyAlive: 0,
  enemyAlive: 0,
  threatLines: [],
};

let state: HudState = empty;
const listeners = new Set<() => void>();

export function getHudState(): HudState {
  return state;
}

export function setHudState(next: HudState): void {
  state = next;
  for (const l of listeners) l();
}

export function subscribeHud(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
