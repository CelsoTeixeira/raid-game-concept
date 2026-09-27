import { useRef, useState } from "react";
import type { GroupMember } from "../sim/group";
import type { InventoryItem, InventoryPlacement } from "../sim/inventory";
import { formatItemBonuses, formatItemBonusesShort } from "../sim/items";
import { appearanceFrames, getMemberAppearance } from "../appearance";
import {
  CLASS_SPECS,
  PRIMARY_STATS,
  STAT_HELPS,
  STAT_LABELS,
  UNIT_CLASSES,
  classLabel,
  getSpec,
  specLabel,
  type UnitClass,
} from "../sim/classes";
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_LABELS,
  characterWithClass,
  characterWithSpec,
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

function roleLabel(role: GroupMember["role"]): string {
  return role === "dps" ? "DPS" : role[0].toUpperCase() + role.slice(1);
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
  const spec = getSpec(member);
  const combat = member.stats;
  const unitLabel = `Unit ${index + 1}`;
  const specs = CLASS_SPECS[member.unitClass];

  return (
    <section
      className="character-panel"
      id="character-panel"
      aria-labelledby="character-panel-title"
    >
      <div className="character-panel-heading">
        <div>
          <h3 id="character-panel-title">
            {unitLabel} · {classLabel(member.unitClass)}
          </h3>
          <p>{spec.blurb}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={`Close ${unitLabel} equipment panel`}>
          Close
        </button>
      </div>
      <div className="character-panel-content">
        <div className="character-panel-preview">
          <MemberPreview member={member} index={index} />
          <strong>
            {classLabel(member.unitClass)} · {specLabel(member)}
          </strong>
          <span>
            {roleLabel(member.role)} · {member.rangeType === "melee" ? "Melee" : "Ranged"}
          </span>
        </div>
        <div className="character-sheet">
          <div className="kit-fields">
            <label>
              Class
              <select
                value={member.unitClass}
                onChange={(event) => onChange(characterWithClass(member, event.target.value as UnitClass))}
              >
                {UNIT_CLASSES.map((unitClass) => (
                  <option key={unitClass} value={unitClass}>
                    {classLabel(unitClass)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Spec
              <select
                value={member.subclass}
                onChange={(event) => onChange(characterWithSpec(member, event.target.value))}
              >
                {Object.entries(specs).map(([id, def]) => (
                  <option key={id} value={id}>
                    {def.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ul className="primary-stats" aria-label="Primary stats">
            {PRIMARY_STATS.map((stat) => (
              <li className={spec.powerStat === stat ? "is-power" : undefined} key={stat}>
                <span>{STAT_LABELS[stat]}</span>
                <strong>{member.attributes[stat]}</strong>
                <span>{STAT_HELPS[stat]}</span>
              </li>
            ))}
          </ul>
          <p className="derived-stats">
            HP {combat.maxHealth} · AP {combat.attackPower}
            {combat.magicPower > 0 ? ` · Heal ${combat.magicPower}` : ""}
            {combat.maxMana > 0 ? ` · Mana ${combat.maxMana}` : ""} · Armor {combat.armor}
          </p>
          <ul className="equipment-slots" aria-label={`${unitLabel} equipment slots`}>
            {EQUIPMENT_SLOTS.map((slot) => {
              const item = member.equipment[slot];
              const isDragging = drag?.source.from === "slot" && drag.source.slot === slot;
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
                        aria-label={`${item.name}, ${item.rarity}, ${formatItemBonuses(item.bonuses) || "no bonuses"}. Drag to the bag or double-click to unequip.`}
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
                <strong>{classLabel(member.unitClass)}</strong>
                <span>{specLabel(member)}</span>
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
