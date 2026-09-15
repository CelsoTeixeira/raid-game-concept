export type RaidCommands = {
  spawnEnemy: () => void;
  toggleAutoAttack: () => void;
  reset: () => void;
};

/** Scene registers these in `create` and clears them on shutdown (avoids a dead Phaser scene). */
let commands: RaidCommands | null = null;

export function getRaidCommands(): RaidCommands | null {
  return commands;
}

export function setRaidCommands(next: RaidCommands | null): void {
  commands = next;
}
