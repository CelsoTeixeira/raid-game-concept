import { appearanceFrames, getMemberAppearance } from "../appearance";
import {
  EQUIPMENT_SLOT_LABELS,
  EQUIPMENT_SLOTS,
  slotsForItem,
  type Character,
  type EquipmentSlot,
} from "../sim/character";
import { GEAR_KINDS } from "../sim/gearKinds";
import type { GuildCharacter } from "../sim/guild";
import { RARITY_LABELS } from "../sim/inventory";
import { formatItemBonuses, formatItemBonusesShort, formatWeapon } from "../sim/items";
import { formatName, REGION_LABELS, SEX_LABELS } from "../sim/names";
import { armorMitigation, isRanged, PRIMARY_STATS, STAT_HELPS, STAT_LABELS, UNARMED } from "../sim/stats";
import type { ItemDrag, ItemDragHandlers, StartItemDrag } from "./itemDrag";
import { SpriteStack } from "./SpriteStack";

function derivedStatsLine(character: Character): string {
  const combat = character.stats;
  const parts = [
    `HP ${combat.maxHealth}`,
    `AP ${combat.attackPower}`,
    `${combat.attackSpeed}/s`,
    isRanged(combat) ? `Range ${combat.attackRange}` : "Melee",
  ];
  if (combat.cleave > 0) parts.push(`Cleave ${Math.round(combat.cleave * 100)}%`);
  if (combat.healPower > 0) parts.push(`Heal ${combat.healPower}`);
  parts.push(`Mana ${combat.maxMana}`);
  parts.push(`Armor ${combat.armor} (${Math.round(armorMitigation(combat.armor) * 100)}%)`);
  if (combat.threat > 1) parts.push(`Threat ×${combat.threat}`);
  parts.push(`Move ${combat.movementSpeed}`);
  return parts.join(" · ");
}

function slotDropClass(drag: ItemDrag | null, slot: EquipmentSlot): string {
  if (drag?.source.from !== "bag") return "";
  const fits = slotsForItem(drag.source.item.slot).includes(slot);
  const isOver = drag.target?.to === "slot" && drag.target.slot === slot;
  if (isOver) return fits ? "is-drop-over" : "is-drop-blocked";
  return fits ? "is-drop-allowed" : "";
}

/** One guild character's stats and equipment. Gear moves between these slots and storage. */
export function GuildCharacterPanel({
  character,
  index,
  drag,
  startDrag,
  dragHandlers,
  onUnequip,
  onClose,
}: {
  character: GuildCharacter;
  index: number;
  drag: ItemDrag | null;
  startDrag: StartItemDrag;
  dragHandlers: ItemDragHandlers;
  onUnequip: (slot: EquipmentSlot) => void;
  onClose: () => void;
}) {
  const name = formatName(character.name);
  const mainHand = character.equipment.mainHand;
  const weapon = (mainHand && GEAR_KINDS[mainHand.kind].weapon) || UNARMED;

  return (
    <section className="character-panel" aria-labelledby="character-panel-title">
      <div className="character-panel-heading">
        <div>
          <h3 id="character-panel-title">{name}</h3>
          <p>
            {RARITY_LABELS[character.rarity]} · {SEX_LABELS[character.sex]} · {REGION_LABELS[character.region]}
          </p>
        </div>
        <button type="button" onClick={onClose}>
          Back to characters
        </button>
      </div>
      <div className="character-panel-content">
        <div className="character-panel-preview">
          <SpriteStack frames={appearanceFrames(getMemberAppearance(character, index))} size={85} />
          <span>
            {mainHand ? GEAR_KINDS[mainHand.kind].label : "Unarmed"} · {isRanged(character.stats) ? "Ranged" : "Melee"}
          </span>
        </div>
        <div className="character-sheet">
          <ul className="primary-stats" aria-label="Primary stats">
            {PRIMARY_STATS.map((stat) => {
              const fromGear = character.attributes[stat] - character.baseAttributes[stat];
              return (
                <li className={weapon.scaling === stat ? "is-power" : undefined} key={stat}>
                  <span>{STAT_LABELS[stat]}</span>
                  <strong>{character.attributes[stat]}</strong>
                  <span>
                    {STAT_HELPS[stat]} · base {character.baseAttributes[stat]}
                    {fromGear > 0 ? ` +${fromGear} gear` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="derived-stats">{derivedStatsLine(character)}</p>
          <ul className="equipment-slots" aria-label={`${name} equipment slots`}>
            {EQUIPMENT_SLOTS.map((slot) => {
              const item = character.equipment[slot];
              const isDragging = drag?.source.from === "slot" && drag.source.slot === slot;
              const weaponText = item ? formatWeapon(item.kind) : "";
              return (
                <li className={`equipment-slot ${slotDropClass(drag, slot)}`} data-equipment-slot={slot} key={slot}>
                  <span>{EQUIPMENT_SLOT_LABELS[slot]}</span>
                  {item ? (
                    <div className="equipment-slot-item">
                      <button
                        className={`equipment-slot-gear ${isDragging ? "is-dragging" : ""}`}
                        data-rarity={item.rarity}
                        type="button"
                        title={weaponText || undefined}
                        aria-label={`${item.name}, ${item.rarity} ${GEAR_KINDS[item.kind].label.toLowerCase()}, ${weaponText ? `${weaponText}, ` : ""}${formatItemBonuses(item.bonuses) || "no bonuses"}. Drag to storage or double-click to unequip.`}
                        onPointerDown={(event) => startDrag(event, { from: "slot", item, slot })}
                        onDoubleClick={() => onUnequip(slot)}
                        {...dragHandlers}
                      >
                        <span>{item.name}</span>
                        <span className="item-kind">{GEAR_KINDS[item.kind].label}</span>
                        <span className="equipment-slot-stats">{formatItemBonusesShort(item.bonuses)}</span>
                      </button>
                      <button
                        className="equipment-slot-unequip"
                        type="button"
                        aria-label={`Unequip ${item.name}`}
                        onClick={() => onUnequip(slot)}
                      >
                        Unequip
                      </button>
                    </div>
                  ) : (
                    <span className="equipment-slot-empty">Empty</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
