export function StartScreen({ onPlay }: { onPlay: () => void }) {
  return (
    <main className="screen">
      <h1>Raid Game Concept</h1>
      <p>Build your group and lead them into the field.</p>
      <button type="button" onClick={onPlay}>
        Play
      </button>
    </main>
  );
}
