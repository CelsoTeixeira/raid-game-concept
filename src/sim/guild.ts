import { parseArtLook, rollArtLook, type ArtLook } from "../art";
import {
  characterWithEquipment,
  createCharacter,
  EQUIPMENT_SLOTS,
  emptyEquipment,
  refreshCombat,
  slotsForItem,
  type Character,
  type Equipment,
  type EquipmentSlot,
} from "./character";
import { equipFromBag, unequipToBag, type EquipResult } from "./equip";
import {
  isItemRarity,
  moveInventoryItem,
  parseGearItem,
  parseInventory,
  type InventoryItem,
  type InventoryPlacement,
  type ItemRarity,
} from "./inventory";
import { rollCharacter } from "./characterGen";
import { mulberry32, type Rng } from "./items";
import { REGIONS, SEXES, type CharacterName, type Region, type Sex } from "./names";
import { PRIMARY_STATS } from "./stats";
import type { Attributes, Role } from "./types";

/** A collected character. Name, rarity, and region are fixed when it is received. */
export type GuildCharacter = Character & {
  name: CharacterName;
  rarity: ItemRarity;
  region: Region;
};

/** Everything the player has collected: characters, the storage grid, and one-time rewards taken. */
export type Guild = {
  characters: GuildCharacter[];
  storage: InventoryItem[];
  starterChestOpened: boolean;
};

const GUILD_STORAGE_KEY = "raid-game.guild.v1";

export function emptyGuild(): Guild {
  return { characters: [], storage: [], starterChestOpened: false };
}

/** Rarity of the free roll offered to an empty guild. Lowest quality for now. */
export const FIRST_RECRUIT_RARITY: ItemRarity = "gray";

function newCharacterId(): string {
  const uuid =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `char-${uuid}`;
}

/**
 * An empty guild may roll one character to start with. No-op once anyone is in the guild.
 * Recruits arrive with no gear and the dps role; both are changed later.
 */
export function recruitFirstCharacter(guild: Guild, rng: Rng): Guild {
  if (guild.characters.length > 0) return guild;
  const rolled = rollCharacter({ rng, rarity: FIRST_RECRUIT_RARITY, takenNames: new Set() });
  const character = createCharacter({
    id: newCharacterId(),
    role: "dps",
    sex: rolled.sex,
    look: rolled.look,
    baseAttributes: rolled.baseAttributes,
  });
  return {
    ...guild,
    characters: [{ ...character, name: rolled.name, rarity: rolled.rarity, region: rolled.region }],
  };
}

export type GuildEquipResult = { ok: true; guild: Guild } | { ok: false; reason: string };

function applyEquip(guild: Guild, characterId: string, result: EquipResult): GuildEquipResult {
  if (!result.ok) return result;
  return {
    ok: true,
    guild: {
      ...guild,
      storage: result.bag,
      characters: guild.characters.map((current) =>
        current.id === characterId ? { ...current, ...result.character } : current,
      ),
    },
  };
}

/** Storage item onto a guild character. A replaced item goes back to storage. */
export function equipGuildItem(
  guild: Guild,
  characterId: string,
  itemId: string,
  slot?: EquipmentSlot,
): GuildEquipResult {
  const character = guild.characters.find((current) => current.id === characterId);
  if (!character) return { ok: false, reason: "That character is no longer in the guild." };
  return applyEquip(guild, characterId, equipFromBag(guild.storage, character, itemId, slot));
}

/** Equipped item back to storage, at `placement` or the first free spot. */
export function unequipGuildItem(
  guild: Guild,
  characterId: string,
  slot: EquipmentSlot,
  placement?: InventoryPlacement,
): GuildEquipResult {
  const character = guild.characters.find((current) => current.id === characterId);
  if (!character) return { ok: false, reason: "That character is no longer in the guild." };
  return applyEquip(guild, characterId, unequipToBag(guild.storage, character, slot, placement));
}

/** Destroys a storage item for good. */
export function destroyStorageItem(guild: Guild, itemId: string): Guild {
  const storage = guild.storage.filter((item) => item.id !== itemId);
  return storage.length === guild.storage.length ? guild : { ...guild, storage };
}

/** Destroys an equipped item for good; the character's combat stats refresh. */
export function destroyEquippedItem(guild: Guild, characterId: string, slot: EquipmentSlot): Guild {
  return {
    ...guild,
    characters: guild.characters.map((character) =>
      character.id === characterId && character.equipment[slot]
        ? { ...character, ...characterWithEquipment(character, slot, null) }
        : character,
    ),
  };
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

/** Characters saved with a Kenney look re-roll only the look, stably from their id (D11). */
function lookFromId(id: string, sex: Sex): ArtLook {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (Math.imul(hash, 31) + id.charCodeAt(index)) | 0;
  return rollArtLook(mulberry32(hash >>> 0), sex);
}

function parseCharacter(value: unknown, seenCharacters: Set<string>, seenItems: Set<string>): GuildCharacter | null {
  if (!isRecord(value)) return null;
  const { id, role, sex, region, rarity } = value;
  const name = parseName(value.name);
  const baseAttributes = parseAttributes(value.baseAttributes);
  if (typeof id !== "string" || id.length === 0 || seenCharacters.has(id)) return null;
  if (!name || !baseAttributes) return null;
  if (!isRole(role) || !isSex(sex) || !isRegion(region) || !isItemRarity(rarity)) return null;
  const look = parseArtLook(value.look) ?? lookFromId(id, sex);
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
    return {
      characters,
      storage: parseInventory(parsed.storage, seenItems),
      starterChestOpened: parsed.starterChestOpened === true,
    };
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
      starterChestOpened: guild.starterChestOpened,
    };
    window.localStorage.setItem(GUILD_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage can be unavailable or full; the in-memory guild remains usable.
  }
}
