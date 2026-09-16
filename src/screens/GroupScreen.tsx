import { useState } from "react";
import type { GroupMember } from "../sim/group";
import type { InventoryItem, InventoryPlacement } from "../sim/inventory";
import { appearanceFrames, getMemberAppearance } from "../appearance";
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

function roleLabel(role: GroupMember["role"]): string {
  return role === "dps" ? "DPS" : role[0].toUpperCase() + role.slice(1);
}

function CharacterPanel({
  member,
  index,
  onClose,
}: {
  member: GroupMember;
  index: number;
  onClose: () => void;
}) {
  const unitLabel = `Unit ${index + 1}`;

  return (
    <section
      className="character-panel"
      id="character-panel"
      aria-labelledby="character-panel-title"
    >
      <div className="character-panel-heading">
        <div>
          <h3 id="character-panel-title">{unitLabel} equipment</h3>
          <p>Equipment belongs to this individual unit.</p>
        </div>
        <button type="button" onClick={onClose} aria-label={`Close ${unitLabel} equipment panel`}>
          Close
        </button>
      </div>
      <div className="character-panel-content">
        <div className="character-panel-preview">
          <MemberPreview member={member} index={index} />
          <strong>{unitLabel}</strong>
          <span>
            {roleLabel(member.role)} · {member.rangeType === "melee" ? "Melee" : "Ranged"}
          </span>
        </div>
        <ul className="equipment-slots" aria-label={`${unitLabel} equipment slots`}>
          {EQUIPMENT_SLOT_NAMES.map((slotName) => (
            <li className="equipment-slot" key={slotName}>
              <span>{slotName}</span>
              <span className="equipment-slot-empty">Empty</span>
            </li>
          ))}
        </ul>
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
}: {
  group: GroupMember[];
  bag: InventoryItem[];
  onBack: () => void;
  onEnterField: () => void;
  onMoveBagItem: (itemId: string, placement: InventoryPlacement) => void;
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
                key={`${member.role}-${member.rangeType}-${index}`}
                type="button"
                onClick={() => setSelectedMemberIndex(index)}
              >
                <MemberPreview member={member} index={index} />
                <span className="member-card-unit">Unit {index + 1}</span>
                <strong>{roleLabel(member.role)}</strong>
                <span>{member.rangeType === "melee" ? "Melee" : "Ranged"}</span>
              </button>
            ))}
          </div>
          {selectedMember ? (
            <CharacterPanel
              member={selectedMember}
              index={selectedMemberIndex!}
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
