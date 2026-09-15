import type { GroupMember } from "../sim/group";

function MemberShape({ member }: { member: GroupMember }) {
  if (member.role === "tank") {
    return (
      <svg className="member-shape" viewBox="0 0 48 48" aria-hidden="true">
        <polygon points="24,5 43,39 5,39" fill="#3b82f6" />
      </svg>
    );
  }
  if (member.role === "healer") {
    return (
      <svg className="member-shape" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="17" fill="#22c55e" />
      </svg>
    );
  }
  if (member.rangeType === "ranged") {
    return (
      <svg className="member-shape" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="17" fill="#eab308" />
      </svg>
    );
  }
  return (
    <svg className="member-shape" viewBox="0 0 48 48" aria-hidden="true">
      <polygon points="24,5 43,24 24,43 5,24" fill="#eab308" />
    </svg>
  );
}

function roleLabel(role: GroupMember["role"]): string {
  return role === "dps" ? "DPS" : role[0].toUpperCase() + role.slice(1);
}

export function GroupScreen({
  group,
  onBack,
  onEnterField,
}: {
  group: GroupMember[];
  onBack: () => void;
  onEnterField: () => void;
}) {
  return (
    <main className="screen">
      <h1>Your group</h1>
      <p>Default group for 5-man content</p>
      <div className="member-list">
        {group.map((member, index) => (
          <article className="member-card" key={`${member.role}-${member.rangeType}-${index}`}>
            <MemberShape member={member} />
            <strong>{roleLabel(member.role)}</strong>
            <span>{member.rangeType === "melee" ? "Melee" : "Ranged"}</span>
          </article>
        ))}
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
