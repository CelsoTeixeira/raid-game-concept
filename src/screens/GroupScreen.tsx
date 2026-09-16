import { useState } from "react";
import type { GroupMember } from "../sim/group";
import type { InventoryItem, InventoryPlacement } from "../sim/inventory";
import { appearanceFrames, getMemberAppearance } from "../appearance";
import {
  CLASS_SPECS,
  PRIMARY_STATS,
  STAT_HELPS,
  STAT_LABELS,
  UNIT_CLASSES,
  classLabel,
  getSpec,
  memberRangeType,
  memberRole,
  memberWithClass,
  memberWithSpec,
  specLabel,
  type UnitClass,
} from "../sim/classes";
import { combatStatsFrom } from "../sim/balance";
import { GroupBag } from "./GroupBag";

const EQUIPMENT_SLOT_NAMES = [
  "Main hand",
  "Off hand",
  "Pants",
  "Chest",
  "Amulet",
  "Ring 1",
  "Ring 2",
] as const;

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

function roleLabel(role: ReturnType<typeof memberRole>): string {
  return role === "dps" ? "DPS" : role[0].toUpperCase() + role.slice(1);
}

function CharacterPanel({
  member,
  index,
  onChange,
  onClose,
}: {
  member: GroupMember;
  index: number;
  onChange: (member: GroupMember) => void;
  onClose: () => void;
}) {
  const spec = getSpec(member);
  const combat = combatStatsFrom(spec);
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
            {roleLabel(memberRole(member))} · {memberRangeType(member) === "melee" ? "Melee" : "Ranged"}
          </span>
        </div>
        <div className="character-sheet">
          <div className="kit-fields">
            <label>
              Class
              <select
                value={member.unitClass}
                onChange={(event) => onChange(memberWithClass(event.target.value as UnitClass))}
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
                onChange={(event) => onChange(memberWithSpec(member.unitClass, event.target.value))}
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
                <strong>{spec.attributes[stat]}</strong>
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
            {EQUIPMENT_SLOT_NAMES.map((slotName) => (
              <li className="equipment-slot" key={slotName}>
                <span>{slotName}</span>
                <span className="equipment-slot-empty">Empty</span>
              </li>
            ))}
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
  onEnterField,
  onMoveBagItem,
  onChangeMember,
}: {
  group: GroupMember[];
  bag: InventoryItem[];
  onBack: () => void;
  onEnterField: () => void;
  onMoveBagItem: (itemId: string, placement: InventoryPlacement) => void;
  onChangeMember: (index: number, member: GroupMember) => void;
}) {
  const [selectedMemberIndex, setSelectedMemberIndex] = useState<number | null>(null);
  const selectedMember =
    selectedMemberIndex === null ? undefined : group[selectedMemberIndex];

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
                key={`${member.unitClass}-${member.subclass}-${index}`}
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
              onChange={(next) => onChangeMember(selectedMemberIndex!, next)}
              onClose={() => setSelectedMemberIndex(null)}
            />
          ) : null}
        </section>
        <GroupBag items={bag} onMoveItem={onMoveBagItem} />
      </div>
      <div className="screen-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button type="button" onClick={onEnterField}>
          Enter field
        </button>
      </div>
    </main>
  );
}
