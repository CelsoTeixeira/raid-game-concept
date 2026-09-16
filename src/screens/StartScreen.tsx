export function StartScreen({
  onPlay,
  onDungeon,
  onItems,
}: {
  onPlay: () => void;
  onDungeon: () => void;
  onItems: () => void;
}) {
  return (
    <main className="screen">
      <h1>Raid Game Concept</h1>
      <p>Build your group and lead them into the field, or sketch a dungeon.</p>
      <div className="screen-actions">
        <button type="button" onClick={onPlay}>
          Play
        </button>
        <button type="button" onClick={onDungeon}>
          Dungeon
        </button>
        <button type="button" onClick={onItems}>
          Items
        </button>
      </div>
    </main>
  );
}
