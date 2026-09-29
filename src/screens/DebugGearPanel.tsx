import { useState } from "react";
import type { DebugGearRequest } from "../sim/debugGear";
import {
  ARMOR_FAMILIES,
  ARMOR_FAMILY_DEFS,
  gearKindsForSlot,
  GEAR_SLOT_LABELS,
  GEAR_SLOTS,
  isArmorKind,
  type ArmorFamily,
  type GearSlot,
} from "../sim/gearKinds";
import { ITEM_RARITIES, RARITY_LABELS, type ItemRarity } from "../sim/inventory";

const ARMOR_SET_SLOTS: GearSlot[] = ["head", "chest", "pants"];

function isArmorSlot(slot: GearSlot): boolean {
  return gearKindsForSlot(slot).some(isArmorKind);
}

/** Debug: add chosen gear to guild storage without clearing levels. */
export function DebugGearPanel({ onAdd }: { onAdd: (requests: DebugGearRequest[]) => void }) {
  const [slot, setSlot] = useState<GearSlot>("chest");
  const [family, setFamily] = useState<ArmorFamily | "random">("plate");
  const [rarity, setRarity] = useState<ItemRarity>("gray");
  const armorFamily = family === "random" ? undefined : family;

  return (
    <section className="debug-gear" aria-label="Debug gear">
      <span className="debug-gear-title">Debug gear</span>
      <label>
        Slot
        <select value={slot} onChange={(event) => setSlot(event.target.value as GearSlot)}>
          {GEAR_SLOTS.map((id) => (
            <option key={id} value={id}>
              {GEAR_SLOT_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Subfamily
        <select value={family} onChange={(event) => setFamily(event.target.value as ArmorFamily | "random")}>
          <option value="random">Random</option>
          {ARMOR_FAMILIES.map((id) => (
            <option key={id} value={id}>
              {ARMOR_FAMILY_DEFS[id].label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Rarity
        <select value={rarity} onChange={(event) => setRarity(event.target.value as ItemRarity)}>
          {ITEM_RARITIES.map((id) => (
            <option key={id} value={id}>
              {RARITY_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => onAdd([{ slot, rarity, ...(isArmorSlot(slot) && armorFamily && { armorFamily }) }])}
      >
        Add item
      </button>
      <button
        type="button"
        onClick={() => onAdd(ARMOR_SET_SLOTS.map((armorSlot) => ({ slot: armorSlot, rarity, ...(armorFamily && { armorFamily }) })))}
      >
        Add armor set
      </button>
    </section>
  );
}
