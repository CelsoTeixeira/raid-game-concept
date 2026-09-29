import { outfitFromEquipment } from "../art";
import type { MapSize } from "../sim/dungeon";
import type { Guild, GuildCharacter } from "../sim/guild";
import { ROLE_LABELS } from "../sim/character";
import { formatName } from "../sim/names";
import { RARITY_LABELS } from "../sim/inventory";
import { ArtCharacter } from "./ArtCharacter";

const MAP_SIZES: MapSize[] = ["small", "medium", "big"];
const GROUP_SIZE = 5;

export function GroupSelectScreen({
  guild,
  pickedIds,
  mapSize,
  onPick,
  onRemove,
  onMapSizeChange,
  onStart,
  onBack,
}: {
  guild: Guild;
  pickedIds: string[];
  mapSize: MapSize;
  onPick: (characterId: string) => void;
  onRemove: (characterId: string) => void;
  onMapSizeChange: (size: MapSize) => void;
  onStart: (group: GuildCharacter[], size: MapSize) => void;
  onBack: () => void;
}) {
  const picked = pickedIds
    .map((id) => guild.characters.find((character) => character.id === id))
    .filter((character): character is GuildCharacter => character !== undefined);
  const pickedSet = new Set(picked.map((character) => character.id));

  return (
    <main className="screen group-select-screen">
      <h1>Build your group</h1>

      <section className="group-select-size" aria-labelledby="group-select-size-title">
        <h2 id="group-select-size-title">Dungeon size</h2>
        <div className="row-inline">
          {MAP_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={mapSize === size ? "is-active" : undefined}
              aria-pressed={mapSize === size}
              onClick={() => onMapSizeChange(size)}
            >
              {size[0].toUpperCase() + size.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <section className="group-select-spots" aria-labelledby="group-select-spots-title">
        <h2 id="group-select-spots-title">Your group ({picked.length}/{GROUP_SIZE})</h2>
        <div className="group-slots">
          {Array.from({ length: GROUP_SIZE }, (_, index) => {
            const character = picked[index];
            return character ? (
              <button
                className="member-card group-slot"
                data-rarity={character.rarity}
                key={character.id}
                type="button"
                aria-label={`Remove ${formatName(character.name)} from group`}
                onClick={() => onRemove(character.id)}
              >
                <ArtCharacter
                  sex={character.sex}
                  look={character.look}
                  outfit={outfitFromEquipment(character.equipment)}
                  scale={2}
                />
                <strong>{formatName(character.name)}</strong>
                <span>{ROLE_LABELS[character.role]}</span>
                <span>{RARITY_LABELS[character.rarity]}</span>
              </button>
            ) : (
              <div className="group-slot group-slot-empty" key={`empty-${index}`} aria-label={`Empty group spot ${index + 1}`}>
                <span>Empty</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="group-select-roster" aria-labelledby="group-select-roster-title">
        <h2 id="group-select-roster-title">Guild characters</h2>
        {guild.characters.length === 0 ? (
          <p>No characters in your guild yet.</p>
        ) : (
          <ul className="member-list group-select-character-list">
            {guild.characters.map((character) => {
              const isPicked = pickedSet.has(character.id);
              const isFull = picked.length >= GROUP_SIZE;
              return (
                <li key={character.id}>
                  <button
                    className={`member-card${isPicked ? " is-picked" : ""}`}
                    data-rarity={character.rarity}
                    type="button"
                    disabled={isPicked || isFull}
                    aria-pressed={isPicked}
                    onClick={() => onPick(character.id)}
                  >
                    <ArtCharacter
                      sex={character.sex}
                      look={character.look}
                      outfit={outfitFromEquipment(character.equipment)}
                      scale={2}
                    />
                    <strong>{formatName(character.name)}</strong>
                    <span>{ROLE_LABELS[character.role]}</span>
                    <span>{RARITY_LABELS[character.rarity]}</span>
                    {isPicked ? <span className="member-card-picked-label">Picked</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="screen-actions">
        <button type="button" disabled={picked.length === 0} onClick={() => onStart(picked, mapSize)}>
          Start
        </button>
        <button type="button" onClick={onBack}>
          Back to guild
        </button>
      </div>
    </main>
  );
}
