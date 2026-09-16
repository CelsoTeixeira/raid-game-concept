export type DungeonCommands = {
  regenerate: () => void;
  clearGroups: () => void;
  setPackSize: (n: number) => void;
};

let commands: DungeonCommands | null = null;

export function getDungeonCommands(): DungeonCommands | null {
  return commands;
}

export function setDungeonCommands(next: DungeonCommands | null): void {
  commands = next;
}
