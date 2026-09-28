import { useRef } from "react";
import { appearanceFrames, getMemberAppearance } from "../appearance";
import type { Guild, GuildCharacter } from "../sim/guild";
import { RARITY_LABELS, type InventoryPlacement } from "../sim/inventory";
import { formatName, REGION_LABELS, SEX_LABELS } from "../sim/names";
import { PRIMARY_STATS, STAT_LABELS } from "../sim/stats";
import { useItemDrag } from "./itemDrag";
import { SpriteStack } from "./SpriteStack";
import { StorageGrid } from "./StorageGrid";

function GuildCharacterCard({ character, index }: { character: GuildCharacter; index: number }) {
  return (
    <li className="member-card" data-rarity={character.rarity}>
      <SpriteStack frames={appearanceFrames(getMemberAppearance(character, index))} size={64} />
      <strong>{formatName(character.name)}</strong>
      <span>
        {RARITY_LABELS[character.rarity]} · {SEX_LABELS[character.sex]} · {REGION_LABELS[character.region]}
      </span>
      <span>
        {PRIMARY_STATS.map((stat) => `${STAT_LABELS[stat].slice(0, 3)} ${character.baseAttributes[stat]}`).join(" · ")}
      </span>
    </li>
  );
}

export function GuildScreen({
  guild,
  onMoveStorageItem,
  onPlay,
  onBack,
}: {
  guild: Guild;
  onMoveStorageItem: (itemId: string, placement: InventoryPlacement) => void;
  onPlay: () => void;
  onBack: () => void;
}) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const { drag, start, handlers } = useItemDrag(boardRef, (source, target) => {
    if (source.from === "bag" && target.to === "bag") onMoveStorageItem(source.item.id, target.placement);
  });

  return (
    <main className="screen group-screen">
      <h1>Guild</h1>
      <p>The characters and items you have collected. Clear levels to earn more.</p>

      <div className="group-workspace guild-workspace">
        <section className="group-roster" aria-labelledby="guild-roster-title">
          <div className="group-bag-heading">
            <div>
              <h2 id="guild-roster-title">Characters</h2>
              <p>Everyone in the guild</p>
            </div>
            <span className="group-bag-count">{guild.characters.length} characters</span>
          </div>
          {guild.characters.length === 0 ? (
            <p className="guild-empty">No characters yet.</p>
          ) : (
            <ul className="member-list guild-character-list">
              {guild.characters.map((character, index) => (
                <GuildCharacterCard character={character} index={index} key={character.id} />
              ))}
            </ul>
          )}
        </section>

        <StorageGrid
          items={guild.storage}
          drag={drag}
          boardRef={boardRef}
          startDrag={start}
          dragHandlers={handlers}
          onMoveItem={onMoveStorageItem}
        />
      </div>

      <div className="screen-actions">
        <button type="button" onClick={onPlay}>
          Play
        </button>
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </main>
  );
}
