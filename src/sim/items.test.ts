import { describe, expect, it } from "vitest";
import { BAG_COLUMNS, BAG_ROWS, findInventoryPlacement, itemFitsAt, ITEM_RARITIES } from "./inventory";
import {
  generateGear,
  generateStarterBag,
  mulberry32,
  primaryBonusTotal,
  RARITY_ADJECTIVES,
  RARITY_BUDGET,
  rollItemIntoBag,
} from "./items";

describe("item generation", () => {
  it("spends a larger main-stat budget at each rarity step", () => {
    expect(RARITY_BUDGET.gray).toBeLessThan(RARITY_BUDGET.green);
    expect(RARITY_BUDGET.green).toBeLessThan(RARITY_BUDGET.blue);
    expect(RARITY_BUDGET.blue).toBeLessThan(RARITY_BUDGET.purple);
    expect(RARITY_BUDGET.purple).toBeLessThan(RARITY_BUDGET.orange);

    const rng = mulberry32(7);
    for (const rarity of ITEM_RARITIES) {
      const item = generateGear({ rng, rarity });
      expect(primaryBonusTotal(item.bonuses)).toBe(RARITY_BUDGET[rarity]);
    }
  });

  it("names items with a rarity-specific adjective and a gear noun", () => {
    const rng = mulberry32(21);
    for (const rarity of ITEM_RARITIES) {
      const item = generateGear({ rng, rarity });
      const [adjective, ...rest] = item.name.split(" ");
      expect(RARITY_ADJECTIVES[rarity]).toContain(adjective);
      expect(rest.join(" ").length).toBeGreaterThan(0);
      expect(item.rarity).toBe(rarity);
    }
  });

  it("packs one item of each rarity into the starter bag", () => {
    const bag = generateStarterBag(1);
    expect(bag).toHaveLength(5);
    expect(bag.map((item) => item.rarity).sort()).toEqual([...ITEM_RARITIES].sort());

    bag.forEach((item) => {
      expect(itemFitsAt(bag, item, { x: item.x, y: item.y }, item.id)).toBe(true);
      expect(item.x + item.width).toBeLessThanOrEqual(BAG_COLUMNS);
      expect(item.y + item.height).toBeLessThanOrEqual(BAG_ROWS);
    });
  });

  it("adds a rolled item when the bag has space", () => {
    const empty: ReturnType<typeof generateStarterBag> = [];
    const next = rollItemIntoBag(empty, 99);
    expect(next).toHaveLength(1);
    expect(ITEM_RARITIES).toContain(next[0]!.rarity);
  });

  it("leaves a full bag unchanged when a roll cannot fit", () => {
    const full = [];
    for (let y = 0; y < BAG_ROWS; y += 1) {
      for (let x = 0; x < BAG_COLUMNS; x += 1) {
        full.push({
          id: `fill-${x}-${y}`,
          name: "Worn Ring",
          width: 1,
          height: 1,
          x,
          y,
          bonuses: { vitality: 1 },
          rarity: "gray" as const,
          kind: "ring" as const,
          slot: "ring" as const,
        });
      }
    }
    expect(findInventoryPlacement(full, { width: 1, height: 1 })).toBeNull();
    expect(rollItemIntoBag(full, 3)).toEqual(full);
  });
});
