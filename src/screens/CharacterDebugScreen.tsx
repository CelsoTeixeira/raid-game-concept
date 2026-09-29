import { useState } from "react";
import { isHeldKind, PLAIN_OUTFIT, type ArtOutfit, type HeldKind } from "../art";
import { CHARACTER_RARITY_POINTS, rollCharacter, type RolledCharacter } from "../sim/characterGen";
import { ARMOR_FAMILIES, ARMOR_FAMILY_DEFS, GEAR_KINDS, gearKindsForSlot, type ArmorFamily } from "../sim/gearKinds";
import { ITEM_RARITIES, RARITY_LABELS, type ItemRarity } from "../sim/inventory";
import { mulberry32 } from "../sim/items";
import { formatName, nameKey, REGION_LABELS, REGIONS, SEX_LABELS, SEXES, type Region, type Sex } from "../sim/names";
import { BASE_ATTRIBUTE_FLOOR, deriveStats, NO_GEAR, PRIMARY_STATS, STAT_LABELS, UNARMED } from "../sim/stats";
import { ArtCharacter } from "./ArtCharacter";

type RegionFilter = "any" | Region;
type SexFilter = "any" | Sex;

type DebugCharacter = RolledCharacter & { key: string };

type Option<T extends string> = { id: T; label: string };

const FAMILY_OPTIONS: Option<ArmorFamily>[] = ARMOR_FAMILIES.map((id) => ({ id, label: ARMOR_FAMILY_DEFS[id].label }));

function heldOptions(slot: "mainHand" | "offHand"): Option<HeldKind>[] {
  return gearKindsForSlot(slot)
    .filter(isHeldKind)
    .map((id) => ({ id, label: GEAR_KINDS[id].label }));
}

const MAIN_HAND_OPTIONS = heldOptions("mainHand");
const OFF_HAND_OPTIONS = heldOptions("offHand");

function OutfitSelect<T extends string>({
  label,
  none,
  options,
  value,
  onChange,
}: {
  label: string;
  none: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <label>
      {label}
      <select value={value ?? ""} onChange={(event) => onChange((event.target.value || null) as T | null)}>
        <option value="">{none}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function attributeTotal(character: RolledCharacter): number {
  return PRIMARY_STATS.reduce((sum, stat) => sum + character.baseAttributes[stat], 0);
}

/** Only the stats that do not depend on gear. */
function bareStats(character: RolledCharacter) {
  const stats = deriveStats(character.baseAttributes, UNARMED, NO_GEAR);
  return { health: stats.maxHealth, mana: stats.maxMana, move: stats.movementSpeed };
}

function CharacterCard({ character, outfit }: { character: DebugCharacter; outfit: ArtOutfit }) {
  const stats = bareStats(character);
  return (
    <article className="item-debug-card" data-rarity={character.rarity}>
      <ArtCharacter sex={character.sex} look={character.look} outfit={outfit} scale={3} />
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
  const [outfit, setOutfit] = useState<ArtOutfit>(PLAIN_OUTFIT);

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
        <div className="item-debug-field">
          <span>Outfit preview (all characters)</span>
          <OutfitSelect
            label="Chest"
            none="Plain"
            options={FAMILY_OPTIONS}
            value={outfit.chest}
            onChange={(chest) => setOutfit((current) => ({ ...current, chest }))}
          />
          <OutfitSelect
            label="Pants"
            none="Plain"
            options={FAMILY_OPTIONS}
            value={outfit.pants}
            onChange={(pants) => setOutfit((current) => ({ ...current, pants }))}
          />
          <OutfitSelect
            label="Helmet"
            none="None"
            options={FAMILY_OPTIONS}
            value={outfit.helmet}
            onChange={(helmet) => setOutfit((current) => ({ ...current, helmet }))}
          />
          <OutfitSelect
            label="Main hand"
            none="Empty"
            options={MAIN_HAND_OPTIONS}
            value={outfit.mainHand}
            onChange={(mainHand) => setOutfit((current) => ({ ...current, mainHand }))}
          />
          <OutfitSelect
            label="Off hand"
            none="Empty"
            options={OFF_HAND_OPTIONS}
            value={outfit.offHand}
            onChange={(offHand) => setOutfit((current) => ({ ...current, offHand }))}
          />
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
            <CharacterCard character={character} outfit={outfit} key={character.key} />
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
                      <ArtCharacter sex={character.sex} look={character.look} outfit={outfit} scale={2} />
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
