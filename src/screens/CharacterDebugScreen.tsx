import { useState } from "react";
import { lookFrames, type CharacterLook } from "../appearance";
import { CHARACTER_RARITY_POINTS, rollCharacter, type RolledCharacter } from "../sim/characterGen";
import { ITEM_RARITIES, type ItemRarity } from "../sim/inventory";
import { mulberry32 } from "../sim/items";
import { formatName, nameKey, REGION_LABELS, REGIONS, SEX_LABELS, SEXES, type Region, type Sex } from "../sim/names";
import { BASE_ATTRIBUTE_FLOOR, deriveStats, NO_GEAR, PRIMARY_STATS, STAT_LABELS, UNARMED } from "../sim/stats";

type RegionFilter = "any" | Region;
type SexFilter = "any" | Sex;

type DebugCharacter = RolledCharacter & { key: string };

const RARITY_LABELS: Record<ItemRarity, string> = {
  gray: "Gray",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  orange: "Orange",
};

function attributeTotal(character: RolledCharacter): number {
  return PRIMARY_STATS.reduce((sum, stat) => sum + character.baseAttributes[stat], 0);
}

/** Only the stats that do not depend on gear. */
function bareStats(character: RolledCharacter) {
  const stats = deriveStats(character.baseAttributes, UNARMED, NO_GEAR);
  return { health: stats.maxHealth, mana: stats.maxMana, move: stats.movementSpeed };
}

/** Sheet tiles are 16px with a 1px margin; `size` is the drawn tile size in px. */
function LookSprite({ look, size }: { look: CharacterLook; size: number }) {
  const scale = size / 16;
  const layerStyle = { width: size, height: size, backgroundSize: `${918 * scale}px ${203 * scale}px` };
  return (
    <span className="member-preview" style={{ width: size, height: size }} aria-hidden="true">
      {lookFrames(look).map((frame, index) => (
        <span
          className="member-sprite-layer"
          key={`${frame.col}-${frame.row}-${index}`}
          style={{ ...layerStyle, backgroundPosition: `-${frame.col * 17 * scale}px -${frame.row * 17 * scale}px` }}
        />
      ))}
    </span>
  );
}

function CharacterCard({ character }: { character: DebugCharacter }) {
  const stats = bareStats(character);
  return (
    <article className="item-debug-card" data-rarity={character.rarity}>
      <LookSprite look={character.look} size={80} />
      <strong>{formatName(character.name)}</strong>
      <span>
        {RARITY_LABELS[character.rarity]} · {SEX_LABELS[character.sex]} · {REGION_LABELS[character.region]}
      </span>
      <span>
        {PRIMARY_STATS.map((stat) => `${STAT_LABELS[stat].slice(0, 3)} ${character.baseAttributes[stat]}`).join(" · ")}
      </span>
      <span>
        {attributeTotal(character)} total · HP {stats.health} · MP {stats.mana} · Move {stats.move}
      </span>
    </article>
  );
}

export function CharacterDebugScreen({ onBack }: { onBack: () => void }) {
  const [rarity, setRarity] = useState<ItemRarity>("green");
  const [region, setRegion] = useState<RegionFilter>("any");
  const [sex, setSex] = useState<SexFilter>("any");
  const [seedText, setSeedText] = useState("1");
  const [characters, setCharacters] = useState<DebugCharacter[]>([]);
  const [ladder, setLadder] = useState<DebugCharacter[]>([]);
  const [takenNames, setTakenNames] = useState<ReadonlySet<string>>(() => new Set());
  const [lastSeed, setLastSeed] = useState<number | null>(null);

  const seed = Number.parseInt(seedText, 10);
  const seedValue = Number.isFinite(seed) ? seed >>> 0 : 1;

  /** Rolls in order against the name ledger so no full name repeats on this screen. */
  const roll = (rarities: readonly ItemRarity[], keyPrefix: string): DebugCharacter[] => {
    const rng = mulberry32(seedValue);
    const taken = new Set(takenNames);
    const batch = rarities.map((pinned, index) => {
      const character = rollCharacter({
        rng,
        rarity: pinned,
        region: region === "any" ? undefined : region,
        sex: sex === "any" ? undefined : sex,
        takenNames: taken,
      });
      taken.add(nameKey(character.name));
      return { ...character, key: `${keyPrefix}-${index}` };
    });
    setTakenNames(taken);
    setCharacters((current) => [...batch, ...current].slice(0, 100));
    setLastSeed(seedValue);
    setSeedText(String((seedValue + 1) >>> 0));
    return batch;
  };

  const addRoll = (count: number) => {
    roll(Array.from({ length: count }, () => rarity), `roll-${Date.now()}`);
  };

  const addLadder = () => {
    setLadder(roll(ITEM_RARITIES, `ladder-${Date.now()}`));
  };

  const clear = () => {
    setCharacters([]);
    setLadder([]);
    setTakenNames(new Set());
  };

  return (
    <main className="screen item-debug-screen">
      <h1>Character generation</h1>
      <p>Roll characters at a rarity. Rarity sets the base attribute points; region and sex only change the name.</p>

      <section className="item-debug-controls" aria-label="Generation filters">
        <div className="item-debug-field">
          <span>Rarity</span>
          <div className="row-inline">
            {ITEM_RARITIES.map((id) => (
              <button
                type="button"
                className={rarity === id ? "is-active" : undefined}
                data-rarity={id}
                key={id}
                onClick={() => setRarity(id)}
              >
                {RARITY_LABELS[id]}
              </button>
            ))}
          </div>
        </div>
        <div className="item-debug-field">
          <label>
            Region
            <select value={region} onChange={(event) => setRegion(event.target.value as RegionFilter)}>
              <option value="any">Any</option>
              {REGIONS.map((id) => (
                <option key={id} value={id}>
                  {REGION_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sex
            <select value={sex} onChange={(event) => setSex(event.target.value as SexFilter)}>
              <option value="any">Any</option>
              {SEXES.map((id) => (
                <option key={id} value={id}>
                  {SEX_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Seed
            <input inputMode="numeric" value={seedText} onChange={(event) => setSeedText(event.target.value)} />
          </label>
        </div>
        <div className="row-inline">
          <button type="button" onClick={() => addRoll(1)}>
            Roll 1
          </button>
          <button type="button" onClick={() => addRoll(10)}>
            Roll 10
          </button>
          <button type="button" onClick={() => addRoll(25)}>
            Roll 25
          </button>
          <button type="button" onClick={addLadder}>
            Roll ladder
          </button>
          <button type="button" onClick={clear}>
            Clear log
          </button>
        </div>
      </section>

      <p className="item-debug-meta">
        Points {ITEM_RARITIES.map((id) => `${RARITY_LABELS[id]} ${CHARACTER_RARITY_POINTS[id]}`).join(" · ")} (floor{" "}
        {BASE_ATTRIBUTE_FLOOR} each) · names issued {takenNames.size}
        {lastSeed === null ? "" : ` · last seed ${lastSeed}`}
      </p>

      {ladder.length > 0 ? (
        <section className="item-debug-ladder" aria-label="Rarity ladder">
          {ladder.map((character) => (
            <CharacterCard character={character} key={character.key} />
          ))}
        </section>
      ) : null}

      <div className="item-debug-table-wrap">
        <table className="item-debug-table">
          <thead>
            <tr>
              <th>Look</th>
              <th>Rarity</th>
              <th>Name</th>
              <th>Sex</th>
              <th>Region</th>
              {PRIMARY_STATS.map((stat) => (
                <th key={stat}>{STAT_LABELS[stat].slice(0, 3)}</th>
              ))}
              <th>Total</th>
              <th>HP</th>
              <th>MP</th>
              <th>Move</th>
            </tr>
          </thead>
          <tbody>
            {characters.length === 0 ? (
              <tr>
                <td colSpan={13}>No rolls yet. Roll 1 or Roll ladder to fill this log.</td>
              </tr>
            ) : (
              characters.map((character) => {
                const stats = bareStats(character);
                return (
                  <tr data-rarity={character.rarity} key={character.key}>
                    <td>
                      <LookSprite look={character.look} size={48} />
                    </td>
                    <td>{RARITY_LABELS[character.rarity]}</td>
                    <td>{formatName(character.name)}</td>
                    <td>{SEX_LABELS[character.sex]}</td>
                    <td>{REGION_LABELS[character.region]}</td>
                    {PRIMARY_STATS.map((stat) => (
                      <td key={stat}>{character.baseAttributes[stat]}</td>
                    ))}
                    <td>{attributeTotal(character)}</td>
                    <td>{stats.health}</td>
                    <td>{stats.mana}</td>
                    <td>{stats.move}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="screen-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </main>
  );
}
