import type { MapSize } from "../sim/dungeon";

export type DungeonCommands = {
  regenerate: () => void;
  setMapSize: (size: MapSize) => void;
  clearGroups: () => void;
  setPackSize: (n: number) => void;
  startGame: () => void;
};

let commands: DungeonCommands | null = null;

export function getDungeonCommands(): DungeonCommands | null {
  return commands;
}

export function setDungeonCommands(next: DungeonCommands | null): void {
  commands = next;
}
