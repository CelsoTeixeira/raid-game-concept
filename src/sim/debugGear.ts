import type { ArmorFamily, GearSlot } from "./gearKinds";
import type { Guild } from "./guild";
import { addInventoryItem, type InventoryItem, type ItemRarity } from "./inventory";
import { generateGear, newItemId, type Rng } from "./items";

/** `armorFamily` only applies to head, chest, and pants; omitted means a random subfamily. */
export type DebugGearRequest = { slot: GearSlot; rarity: ItemRarity; armorFamily?: ArmorFamily };

export type DebugGearResult = { guild: Guild; added: InventoryItem[]; skipped: number };

/** Debug: generates gear into guild storage. Pieces that do not fit are skipped. */
export function addDebugGear(guild: Guild, requests: readonly DebugGearRequest[], rng: Rng): DebugGearResult {
  let storage = guild.storage;
  const added: InventoryItem[] = [];
  let skipped = 0;
  for (const request of requests) {
    const packed = addInventoryItem(storage, generateGear({ rng, id: newItemId(), ...request }));
    if (!packed) {
      skipped += 1;
      continue;
    }
    storage = packed;
    added.push(packed[packed.length - 1]!);
  }
  return { guild: { ...guild, storage }, added, skipped };
}
