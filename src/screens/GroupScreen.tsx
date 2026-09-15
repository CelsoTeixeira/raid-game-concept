import type { GroupMember } from "../sim/group";
import type { InventoryItem, InventoryPlacement } from "../sim/inventory";
import { appearanceFrames, getMemberAppearance } from "../appearance";
import { GroupBag } from "./GroupBag";

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
  return (
    <main className="screen group-screen">
      <h1>Your group</h1>
      <p>Default group for 5-man content</p>
      <div className="group-workspace">
        <section className="group-roster" aria-labelledby="group-roster-title">
          <h2 id="group-roster-title">Roster</h2>
          <div className="member-list">
            {group.map((member, index) => (
              <article className="member-card" key={`${member.role}-${member.rangeType}-${index}`}>
                <MemberPreview member={member} index={index} />
                <strong>{roleLabel(member.role)}</strong>
                <span>{member.rangeType === "melee" ? "Melee" : "Ranged"}</span>
              </article>
            ))}
          </div>
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
