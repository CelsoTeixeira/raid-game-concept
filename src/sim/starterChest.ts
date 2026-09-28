import type { GearKindId } from "./gearKinds";
import type { Guild, GuildCharacter } from "./guild";
import { addInventoryItem, type InventoryItem, type ItemRarity } from "./inventory";
import { generateGear, newItemId, type Rng } from "./items";
import type { PowerStat } from "./stats";
import type { Role } from "./types";

export const STARTER_CHEST_RARITY: ItemRarity = "gray";

/** DPS weapon follows the first character's strongest damage attribute. */
const DPS_WEAPON: Record<PowerStat, GearKindId> = {
  strength: "sword",
  agility: "dagger",
  intelligence: "staff",
};

/** Tank gets a shield (armor, threat); healer gets a wand (healing, ranged). */
const ROLE_KINDS: Record<Exclude<Role, "dps">, GearKindId> = {
  tank: "shield",
  healer: "wand",
};

export type StarterChestItem = { role: Role; item: InventoryItem };

export type StarterChestResult =
  | { ok: true; guild: Guild; items: StarterChestItem[] }
  | { ok: false; reason: string };

/** Offered once, after the guild has its first character. */
export function canOpenStarterChest(guild: Guild): boolean {
  return !guild.starterChestOpened && guild.characters.length > 0;
}

function strongestPowerStat(character: GuildCharacter): PowerStat {
  const stats: PowerStat[] = ["strength", "agility", "intelligence"];
  return stats.reduce((best, stat) =>
    character.baseAttributes[stat] > character.baseAttributes[best] ? stat : best,
  );
}

/** One gray item per role into storage, so the first character can try tank, dps, or healer. */
export function openStarterChest(guild: Guild, rng: Rng): StarterChestResult {
  const first = guild.characters[0];
  if (!first || guild.starterChestOpened) return { ok: false, reason: "The starter chest is not available." };

  const plan: { role: Role; kind: GearKindId }[] = [
    { role: "tank", kind: ROLE_KINDS.tank },
    { role: "dps", kind: DPS_WEAPON[strongestPowerStat(first)] },
    { role: "healer", kind: ROLE_KINDS.healer },
  ];

  let storage = guild.storage;
  const items: StarterChestItem[] = [];
  for (const { role, kind } of plan) {
    const gear = generateGear({ rng, id: newItemId(), rarity: STARTER_CHEST_RARITY, kind });
    const packed = addInventoryItem(storage, gear);
    if (!packed) return { ok: false, reason: `No storage space for ${gear.name}. Free some room and try again.` };
    storage = packed;
    items.push({ role, item: packed[packed.length - 1]! });
  }

  return { ok: true, guild: { ...guild, storage, starterChestOpened: true }, items };
}
