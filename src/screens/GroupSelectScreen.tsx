import type { Guild } from "../sim/guild";

/** Placeholder: picking a group from the guild comes next. */
export function GroupSelectScreen({ guild, onBack }: { guild: Guild; onBack: () => void }) {
  return (
    <main className="screen">
      <h1>Group selection</h1>
      <p>
        Pick the characters for this level from your guild. {guild.characters.length} available. Selection is not
        built yet.
      </p>
      <div className="screen-actions">
        <button type="button" onClick={onBack}>
          Back to guild
        </button>
      </div>
    </main>
  );
}
