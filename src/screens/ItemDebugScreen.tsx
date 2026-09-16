import { useMemo, useState } from "react";
import { EQUIPMENT_SLOT_LABELS, type EquipmentSlot } from "../sim/character";
import { PRIMARY_STATS, STAT_LABELS } from "../sim/classes";
import { ITEM_RARITIES, type ItemRarity, type UnplacedItem } from "../sim/inventory";
import {
  GEAR_SLOTS,
  generateGear,
  mulberry32,
  primaryBonusTotal,
  RARITY_BUDGET,
  RARITY_STAT_COUNT,
  RARITY_WEIGHTS,
} from "../sim/items";

type RarityFilter = "any" | ItemRarity;
type SlotFilter = "any" | (typeof GEAR_SLOTS)[number];

type DebugItem = UnplacedItem & {
  key: string;
  seed: number;
};

const RARITY_LABELS: Record<ItemRarity, string> = {
  gray: "Gray",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  orange: "Orange",
};

function slotLabel(slot: EquipmentSlot): string {
  return slot === "ring1" ? "Ring" : EQUIPMENT_SLOT_LABELS[slot];
}

function rollBatch(
  count: number,
  seed: number,
  rarity: RarityFilter,
  slot: SlotFilter,
  keyPrefix: string,
): DebugItem[] {
  const rng = mulberry32(seed);
  return Array.from({ length: count }, (_, index) => ({
    ...generateGear({
      rng,
      id: `${keyPrefix}-${index}`,
      rarity: rarity === "any" ? undefined : rarity,
      slot: slot === "any" ? undefined : slot,
    }),
    key: `${keyPrefix}-${index}`,
    seed,
  }));
}

function rollLadder(seed: number, slot: SlotFilter, keyPrefix: string): DebugItem[] {
  const rng = mulberry32(seed);
  return ITEM_RARITIES.map((rarity, index) => ({
    ...generateGear({
      rng,
      id: `${keyPrefix}-${rarity}`,
      rarity,
      slot: slot === "any" ? undefined : slot,
    }),
    key: `${keyPrefix}-${rarity}-${index}`,
    seed,
  }));
}

function ItemCard({ item }: { item: DebugItem }) {
  const total = primaryBonusTotal(item.bonuses);
  return (
    <article className="item-debug-card" data-rarity={item.rarity}>
      <strong>{item.name}</strong>
      <span>
        {RARITY_LABELS[item.rarity]} · {slotLabel(item.slot)} · {item.width}×{item.height}
      </span>
      <span>
        {PRIMARY_STATS.map((stat) => `${STAT_LABELS[stat].slice(0, 3)} ${item.bonuses[stat] ?? 0}`).join(" · ")}
      </span>
      <span>
        {total} pts / {RARITY_BUDGET[item.rarity]} budget · {RARITY_STAT_COUNT[item.rarity]} stats
      </span>
    </article>
  );
}

export function ItemDebugScreen({ onBack }: { onBack: () => void }) {
  const [rarity, setRarity] = useState<RarityFilter>("any");
  const [slot, setSlot] = useState<SlotFilter>("any");
  const [seedText, setSeedText] = useState("1");
  const [items, setItems] = useState<DebugItem[]>([]);
  const [ladder, setLadder] = useState<DebugItem[]>([]);
  const [lastSeed, setLastSeed] = useState<number | null>(null);

  const seed = Number.parseInt(seedText, 10);
  const seedValue = Number.isFinite(seed) ? seed >>> 0 : 1;

  const bumpSeed = () => {
    setSeedText(String((seedValue + 1) >>> 0));
  };

  const addRoll = (count: number) => {
    const batch = rollBatch(count, seedValue, rarity, slot, `roll-${Date.now()}`);
    setItems((current) => [...batch, ...current].slice(0, 100));
    setLastSeed(seedValue);
    bumpSeed();
  };

  const addLadder = () => {
    const next = rollLadder(seedValue, slot, `ladder-${Date.now()}`);
    setLadder(next);
    setItems((current) => [...next, ...current].slice(0, 100));
    setLastSeed(seedValue);
    bumpSeed();
  };

  const counts = useMemo(() => {
    const byRarity = Object.fromEntries(ITEM_RARITIES.map((id) => [id, 0])) as Record<ItemRarity, number>;
    for (const item of items) byRarity[item.rarity] += 1;
    return byRarity;
  }, [items]);

  return (
    <main className="screen item-debug-screen">
      <h1>Item generation</h1>
      <p>Roll gear with pinned rarity and slot. Use the ladder to compare names and main-stat budgets.</p>

      <section className="item-debug-controls" aria-label="Generation filters">
        <div className="item-debug-field">
          <span>Rarity</span>
          <div className="row-inline">
            <button
              type="button"
              className={rarity === "any" ? "is-active" : undefined}
              onClick={() => setRarity("any")}
            >
              Any
            </button>
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
            Slot
            <select value={slot} onChange={(event) => setSlot(event.target.value as SlotFilter)}>
              <option value="any">Any</option>
              {GEAR_SLOTS.map((id) => (
                <option key={id} value={id}>
                  {slotLabel(id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Seed
            <input
              inputMode="numeric"
              value={seedText}
              onChange={(event) => setSeedText(event.target.value)}
            />
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
          <button type="button" onClick={() => setItems([])}>
            Clear log
          </button>
        </div>
      </section>

      <p className="item-debug-meta">
        Drop {ITEM_RARITIES.map((id) => `${RARITY_LABELS[id]} ${Math.round(RARITY_WEIGHTS[id] * 100)}%`).join(" · ")}
        {lastSeed === null ? "" : ` · last seed ${lastSeed}`}
        {items.length > 0
          ? ` · log ${ITEM_RARITIES.map((id) => `${RARITY_LABELS[id]} ${counts[id]}`).join(" · ")}`
          : ""}
      </p>

      {ladder.length > 0 ? (
        <section className="item-debug-ladder" aria-label="Rarity ladder">
          {ladder.map((item) => (
            <ItemCard item={item} key={item.key} />
          ))}
        </section>
      ) : null}

      <div className="item-debug-table-wrap">
        <table className="item-debug-table">
          <thead>
            <tr>
              <th>Rarity</th>
              <th>Name</th>
              <th>Slot</th>
              <th>Size</th>
              {PRIMARY_STATS.map((stat) => (
                <th key={stat}>{STAT_LABELS[stat].slice(0, 3)}</th>
              ))}
              <th>Total</th>
              <th>Budget</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9}>No rolls yet. Roll 1 or Roll ladder to fill this log.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr data-rarity={item.rarity} key={item.key}>
                  <td>{RARITY_LABELS[item.rarity]}</td>
                  <td>{item.name}</td>
                  <td>{slotLabel(item.slot)}</td>
                  <td>
                    {item.width}×{item.height}
                  </td>
                  {PRIMARY_STATS.map((stat) => (
                    <td key={stat}>{item.bonuses[stat] ?? 0}</td>
                  ))}
                  <td>{primaryBonusTotal(item.bonuses)}</td>
                  <td>{RARITY_BUDGET[item.rarity]}</td>
                </tr>
              ))
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
