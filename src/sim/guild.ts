import { parseCharacterLook } from "../appearance";
import {
  EQUIPMENT_SLOTS,
  emptyEquipment,
  refreshCombat,
  slotsForItem,
  type Character,
  type Equipment,
} from "./character";
import {
  isItemRarity,
  moveInventoryItem,
  parseGearItem,
  parseInventory,
  type InventoryItem,
  type InventoryPlacement,
  type ItemRarity,
} from "./inventory";
import { REGIONS, SEXES, type CharacterName, type Region, type Sex } from "./names";
import { PRIMARY_STATS } from "./stats";
import type { Attributes, Role } from "./types";

/** A collected character. Name, rarity, and region are fixed when it is received. */
export type GuildCharacter = Character & {
  name: CharacterName;
  rarity: ItemRarity;
  region: Region;
};

/** Everything the player has collected: characters and the storage grid. */
export type Guild = {
  characters: GuildCharacter[];
  storage: InventoryItem[];
};

const GUILD_STORAGE_KEY = "raid-game.guild.v1";

export function emptyGuild(): Guild {
  return { characters: [], storage: [] };
}

export function moveStorageItem(guild: Guild, itemId: string, placement: InventoryPlacement): Guild {
  const storage = moveInventoryItem(guild.storage, itemId, placement);
  return storage === guild.storage ? guild : { ...guild, storage };
}

function isRole(value: unknown): value is Role {
  return value === "tank" || value === "dps" || value === "healer";
}

function isSex(value: unknown): value is Sex {
  return SEXES.includes(value as Sex);
}

function isRegion(value: unknown): value is Region {
  return REGIONS.includes(value as Region);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseName(value: unknown): CharacterName | null {
  if (!isRecord(value)) return null;
  const { given, surname } = value;
  if (typeof given !== "string" || given.length === 0) return null;
  if (typeof surname !== "string" || surname.length === 0) return null;
  return { given, surname };
}

function parseAttributes(value: unknown): Attributes | null {
  if (!isRecord(value)) return null;
  const attributes: Attributes = { vitality: 0, intelligence: 0, strength: 0, agility: 0 };
  for (const stat of PRIMARY_STATS) {
    const amount = value[stat];
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) return null;
    attributes[stat] = amount;
  }
  return attributes;
}

/** Drops items that fail validation, sit in the wrong slot, or repeat an id already seen. */
function parseEquipment(value: unknown, seen: Set<string>): Equipment {
  const equipment = emptyEquipment();
  if (!isRecord(value)) return equipment;
  for (const slot of EQUIPMENT_SLOTS) {
    const item = parseGearItem(value[slot]);
    if (!item || seen.has(item.id) || !slotsForItem(item.slot).includes(slot)) continue;
    seen.add(item.id);
    equipment[slot] = item;
  }
  return equipment;
}

function parseCharacter(value: unknown, seenCharacters: Set<string>, seenItems: Set<string>): GuildCharacter | null {
  if (!isRecord(value)) return null;
  const { id, role, sex, region, rarity } = value;
  const name = parseName(value.name);
  const baseAttributes = parseAttributes(value.baseAttributes);
  const look = parseCharacterLook(value.look);
  if (typeof id !== "string" || id.length === 0 || seenCharacters.has(id)) return null;
  if (!name || !baseAttributes || !look) return null;
  if (!isRole(role) || !isSex(sex) || !isRegion(region) || !isItemRarity(rarity)) return null;
  seenCharacters.add(id);
  const character = refreshCombat({
    id,
    role,
    sex,
    look,
    baseAttributes,
    equipment: parseEquipment(value.equipment, seenItems),
  });
  return { ...character, name, rarity, region };
}

/** Saved guild with invalid entries dropped one by one; empty when nothing is stored. */
export function loadPersistedGuild(): Guild {
  if (typeof window === "undefined") return emptyGuild();

  try {
    const stored = window.localStorage.getItem(GUILD_STORAGE_KEY);
    if (!stored) return emptyGuild();

    const parsed: unknown = JSON.parse(stored);
    if (!isRecord(parsed)) return emptyGuild();

    const seenCharacters = new Set<string>();
    const seenItems = new Set<string>();
    const characters = (Array.isArray(parsed.characters) ? parsed.characters : [])
      .map((value) => parseCharacter(value, seenCharacters, seenItems))
      .filter((character): character is GuildCharacter => character !== null);
    return { characters, storage: parseInventory(parsed.storage, seenItems) };
  } catch {
    return emptyGuild();
  }
}

export function persistGuild(guild: Guild): void {
  if (typeof window === "undefined") return;

  try {
    const stored = {
      characters: guild.characters.map((character) => ({
        id: character.id,
        name: character.name,
        rarity: character.rarity,
        region: character.region,
        sex: character.sex,
        role: character.role,
        look: character.look,
        baseAttributes: character.baseAttributes,
        equipment: character.equipment,
      })),
      storage: guild.storage,
    };
    window.localStorage.setItem(GUILD_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage can be unavailable or full; the in-memory guild remains usable.
  }
}
