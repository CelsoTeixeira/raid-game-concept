import { useRef, useState } from "react";
import type { GroupMember } from "../sim/group";
import type { InventoryItem, InventoryPlacement } from "../sim/inventory";
import { formatItemBonuses, formatItemBonusesShort, formatWeapon, mulberry32 } from "../sim/items";
import { appearanceFrames, getMemberAppearance } from "../appearance";
import {
  armorMitigation,
  isRanged,
  PRIMARY_STATS,
  rollBaseAttributes,
  STAT_HELPS,
  STAT_LABELS,
  UNARMED,
} from "../sim/stats";
import { GEAR_KINDS } from "../sim/gearKinds";
import type { Role } from "../sim/types";
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_LABELS,
  ROLE_HELPS,
  ROLE_LABELS,
  ROLES,
  characterWithBaseAttributes,
  characterWithRole,
  roleHints,
  slotsForItem,
  type EquipmentSlot,
} from "../sim/character";
import { GroupBag } from "./GroupBag";
import {
  useItemDrag,
  type DragSource,
  type DropTarget,
  type ItemDrag,
  type ItemDragHandlers,
  type StartItemDrag,
} from "./itemDrag";

function MemberPreview({ member, index }: { member: GroupMember; index: number }) {
  const frames = appearanceFrames(getMemberAppearance(member, index));

  return (
    <span className="member-preview" aria-hidden="true">
      {frames.map((frame, frameIndex) => (
        <span
          className="member-sprite-layer"
          key={`${frame.col}-${frame.row}-${frameIndex}`}
          style={{ backgroundPosition: `-${frame.col * 85}px -${frame.row * 85}px` }}
        />
      ))}
    </span>
  );
}

function derivedStatsLine(member: GroupMember): string {
  const combat = member.stats;
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

function CharacterPanel({
  member,
  index,
  drag,
  startDrag,
  dragHandlers,
  onChange,
  onUnequip,
  onClose,
}: {
  member: GroupMember;
  index: number;
  drag: ItemDrag | null;
  startDrag: StartItemDrag;
  dragHandlers: ItemDragHandlers;
  onChange: (member: GroupMember) => void;
  onUnequip: (slot: EquipmentSlot) => void;
  onClose: () => void;
}) {
  const unitLabel = `Unit ${index + 1}`;
  const mainHand = member.equipment.mainHand;
  const weapon = (mainHand && GEAR_KINDS[mainHand.kind].weapon) || UNARMED;
  const weaponLabel = mainHand ? GEAR_KINDS[mainHand.kind].label : "Unarmed";
  const hints = roleHints(member);

  return (
    <section
      className="character-panel"
      id="character-panel"
      aria-labelledby="character-panel-title"
    >
      <div className="character-panel-heading">
        <div>
          <h3 id="character-panel-title">
            {unitLabel} · {ROLE_LABELS[member.role]}
          </h3>
          <p>{ROLE_HELPS[member.role]}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={`Close ${unitLabel} equipment panel`}>
          Close
        </button>
      </div>
      <div className="character-panel-content">
        <div className="character-panel-preview">
          <MemberPreview member={member} index={index} />
          <strong>{ROLE_LABELS[member.role]}</strong>
          <span>
            {weaponLabel} · {isRanged(member.stats) ? "Ranged" : "Melee"}
          </span>
        </div>
        <div className="character-sheet">
          <div className="kit-fields">
            <label>
              Role
              <select
                value={member.role}
                onChange={(event) => onChange(characterWithRole(member, event.target.value as Role))}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() =>
                onChange(characterWithBaseAttributes(member, rollBaseAttributes(mulberry32(Date.now()))))
              }
            >
              Reroll base stats
            </button>
          </div>
          <ul className="primary-stats" aria-label="Primary stats">
            {PRIMARY_STATS.map((stat) => {
              const fromGear = member.attributes[stat] - member.baseAttributes[stat];
              return (
                <li className={weapon.scaling === stat ? "is-power" : undefined} key={stat}>
                  <span>{STAT_LABELS[stat]}</span>
                  <strong>{member.attributes[stat]}</strong>
                  <span>
                    {STAT_HELPS[stat]} · base {member.baseAttributes[stat]}
                    {fromGear > 0 ? ` +${fromGear} gear` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="derived-stats">{derivedStatsLine(member)}</p>
          {hints.length > 0 ? (
            <ul className="role-hints">
              {hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          ) : null}
          <ul className="equipment-slots" aria-label={`${unitLabel} equipment slots`}>
            {EQUIPMENT_SLOTS.map((slot) => {
              const item = member.equipment[slot];
              const isDragging = drag?.source.from === "slot" && drag.source.slot === slot;
              const weaponText = item ? formatWeapon(item.kind) : "";
              return (
                <li
                  className={`equipment-slot ${slotDropClass(drag, slot)}`}
                  data-equipment-slot={slot}
                  key={slot}
                >
                  <span>{EQUIPMENT_SLOT_LABELS[slot]}</span>
                  {item ? (
                    <div className="equipment-slot-item">
                      <button
                        className={`equipment-slot-gear ${isDragging ? "is-dragging" : ""}`}
                        data-rarity={item.rarity}
                        type="button"
                        title={weaponText || undefined}
                        aria-label={`${item.name}, ${item.rarity}, ${weaponText ? `${weaponText}, ` : ""}${formatItemBonuses(item.bonuses) || "no bonuses"}. Drag to the bag or double-click to unequip.`}
                        onPointerDown={(event) => startDrag(event, { from: "slot", item, slot })}
                        onDoubleClick={() => onUnequip(slot)}
                        {...dragHandlers}
                      >
                        <span>{item.name}</span>
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

export function GroupScreen({
  group,
  bag,
  onBack,
  onEnterDungeon,
  onMoveBagItem,
  onRollBagItem,
  onEquipItem,
  onUnequipItem,
  onChangeMember,
}: {
  group: GroupMember[];
  bag: InventoryItem[];
  onBack: () => void;
  onEnterDungeon: () => void;
  onMoveBagItem: (itemId: string, placement: InventoryPlacement) => void;
  onRollBagItem: () => void;
  /** Returns why the item could not be equipped, or null on success. */
  onEquipItem: (memberIndex: number, itemId: string, slot?: EquipmentSlot) => string | null;
  /** Returns why the item could not be unequipped, or null on success. */
  onUnequipItem: (memberIndex: number, slot: EquipmentSlot, placement?: InventoryPlacement) => string | null;
  onChangeMember: (index: number, member: GroupMember) => void;
}) {
  const [selectedMemberIndex, setSelectedMemberIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const selectedMember =
    selectedMemberIndex === null ? undefined : group[selectedMemberIndex];

  const equip = (itemId: string, slot?: EquipmentSlot) => {
    if (selectedMemberIndex === null) return;
    setNotice(onEquipItem(selectedMemberIndex, itemId, slot));
  };

  const unequip = (slot: EquipmentSlot, placement?: InventoryPlacement) => {
    if (selectedMemberIndex === null) return;
    setNotice(onUnequipItem(selectedMemberIndex, slot, placement));
  };

  const handleDrop = (source: DragSource, target: NonNullable<DropTarget>) => {
    if (source.from === "bag") {
      if (target.to === "slot") {
        equip(source.item.id, target.slot);
      } else if (target.placement.x !== source.item.x || target.placement.y !== source.item.y) {
        setNotice(null);
        onMoveBagItem(source.item.id, target.placement);
      }
      return;
    }
    if (target.to === "bag") unequip(source.slot, target.placement);
  };

  const { drag, start: startDrag, handlers: dragHandlers } = useItemDrag(boardRef, handleDrop);

  return (
    <main className="screen group-screen">
      <h1>Your group</h1>
      <p>Default group for 5-man content</p>
      <div className="group-workspace">
        <section className="group-roster" aria-labelledby="group-roster-title">
          <h2 id="group-roster-title">Roster</h2>
          <div className="member-list">
            {group.map((member, index) => (
              <button
                aria-controls="character-panel"
                aria-expanded={selectedMemberIndex === index}
                className={`member-card ${selectedMemberIndex === index ? "is-selected" : ""}`}
                key={member.id}
                type="button"
                onClick={() => setSelectedMemberIndex(index)}
              >
                <MemberPreview member={member} index={index} />
                <span className="member-card-unit">Unit {index + 1}</span>
                <strong>{ROLE_LABELS[member.role]}</strong>
                <span>{member.equipment.mainHand ? GEAR_KINDS[member.equipment.mainHand.kind].label : "Unarmed"}</span>
              </button>
            ))}
          </div>
          {selectedMember ? (
            <CharacterPanel
              member={selectedMember}
              index={selectedMemberIndex!}
              drag={drag}
              startDrag={startDrag}
              dragHandlers={dragHandlers}
              onChange={(next) => onChangeMember(selectedMemberIndex!, next)}
              onUnequip={(slot) => unequip(slot)}
              onClose={() => setSelectedMemberIndex(null)}
            />
          ) : null}
        </section>
        <GroupBag
          items={bag}
          drag={drag}
          boardRef={boardRef}
          startDrag={startDrag}
          dragHandlers={dragHandlers}
          canEquip={selectedMember !== undefined}
          notice={notice}
          onMoveItem={onMoveBagItem}
          onEquipItem={(itemId) => equip(itemId)}
          onRollItem={onRollBagItem}
        />
      </div>
      <div className="screen-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button type="button" onClick={onEnterDungeon}>
          Enter dungeon
        </button>
      </div>
    </main>
  );
}
