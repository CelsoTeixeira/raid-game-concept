import {
  characterWithEquipment,
  EQUIPMENT_SLOT_LABELS,
  slotsForItem,
  type Character,
  type EquipmentSlot,
} from "./character";
import {
  addInventoryItem,
  itemFitsAt,
  type InventoryItem,
  type InventoryPlacement,
  type UnplacedItem,
} from "./inventory";

export type EquipResult =
  | { ok: true; bag: InventoryItem[]; character: Character }
  | { ok: false; reason: string };

function unplaced(item: InventoryItem): UnplacedItem {
  return {
    id: item.id,
    name: item.name,
    width: item.width,
    height: item.height,
    bonuses: item.bonuses,
    rarity: item.rarity,
    kind: item.kind,
    slot: item.slot,
  };
}

/**
 * Move a bag item onto the character. Without a slot, prefer an empty matching slot.
 * A replaced item goes back to the bag, into the vacated spot when it fits.
 */
export function equipFromBag(
  bag: InventoryItem[],
  character: Character,
  itemId: string,
  slot?: EquipmentSlot,
): EquipResult {
  const item = bag.find((candidate) => candidate.id === itemId);
  if (!item) return { ok: false, reason: "That item is no longer in the bag." };

  const allowed = slotsForItem(item.slot);
  if (slot && !allowed.includes(slot)) {
    return { ok: false, reason: `${item.name} does not fit the ${EQUIPMENT_SLOT_LABELS[slot]} slot.` };
  }
  const target = slot ?? allowed.find((candidate) => !character.equipment[candidate]) ?? allowed[0]!;

  let nextBag = bag.filter((candidate) => candidate.id !== itemId);
  const replaced = character.equipment[target];
  if (replaced) {
    const vacated = { x: item.x, y: item.y };
    const packed = itemFitsAt(nextBag, replaced, vacated)
      ? [...nextBag, { ...replaced, ...vacated }]
      : addInventoryItem(nextBag, replaced);
    if (!packed) return { ok: false, reason: `No bag space for ${replaced.name}.` };
    nextBag = packed;
  }

  return { ok: true, bag: nextBag, character: characterWithEquipment(character, target, unplaced(item)) };
}

/** Move an equipped item to the bag, at `placement` or the first free spot. */
export function unequipToBag(
  bag: InventoryItem[],
  character: Character,
  slot: EquipmentSlot,
  placement?: InventoryPlacement,
): EquipResult {
  const item = character.equipment[slot];
  if (!item) return { ok: false, reason: `${EQUIPMENT_SLOT_LABELS[slot]} is empty.` };

  let nextBag: InventoryItem[] | null;
  if (placement) {
    if (!itemFitsAt(bag, item, placement)) return { ok: false, reason: "That bag spot is blocked." };
    nextBag = [...bag, { ...item, ...placement }];
  } else {
    nextBag = addInventoryItem(bag, item);
    if (!nextBag) return { ok: false, reason: `No bag space for ${item.name}.` };
  }

  return { ok: true, bag: nextBag, character: characterWithEquipment(character, slot, null) };
}
