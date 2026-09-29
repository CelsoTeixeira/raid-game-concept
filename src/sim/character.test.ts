import { describe, expect, it } from "vitest";
import type { ArtLook } from "../art";
import { characterWithEquipment, characterWithRole, createCharacter } from "./character";
import { DEFAULT_GROUP } from "./group";
import { HEALTH_PER_VITALITY } from "./stats";
import { World } from "./world";

const BASE = { vitality: 10, intelligence: 5, strength: 8, agility: 4 };
const LOOK: ArtLook = { build: "normal", skin: "light", hairStyle: "sweep", hairColor: "brown" };

describe("cached combat stats", () => {
  it("derives combat numbers from base attributes, not from role", () => {
    const tank = createCharacter({ id: "test-tank", role: "tank", baseAttributes: BASE, sex: "male", look: LOOK });
    expect(tank.stats.maxHealth).toBe(20 + 10 * HEALTH_PER_VITALITY);
    expect(tank.stats.attackPower).toBe(1 + BASE.strength);
    expect(tank.stats.healPower).toBe(0);

    const healer = characterWithRole(tank, "healer");
    expect(healer.id).toBe(tank.id);
    expect(healer.role).toBe("healer");
    expect(healer.stats).toEqual(tank.stats);
  });

  it("rebuilds the cache when gear is equipped, not during combat ticks", () => {
    const bare = createCharacter({ id: "test-bare", role: "dps", baseAttributes: BASE, sex: "male", look: LOOK });
    const bareHp = bare.stats.maxHealth;

    const withSword = characterWithEquipment(bare, "mainHand", {
      id: "sword",
      name: "Sword",
      width: 1,
      height: 3,
      rarity: "gray",
      kind: "sword",
      slot: "mainHand",
      bonuses: { strength: 2 },
    });
    expect(withSword.attributes.strength).toBe(BASE.strength + 2);
    expect(withSword.stats.attackPower).toBeGreaterThan(bare.stats.attackPower);

    const withRing = characterWithEquipment(withSword, "ring1", {
      id: "ring",
      name: "Ring",
      width: 1,
      height: 1,
      rarity: "gray",
      kind: "ring",
      slot: "ring",
      bonuses: { vitality: 1 },
    });
    expect(withRing.stats.maxHealth).toBe(bareHp + HEALTH_PER_VITALITY);
    expect(withRing.stats.armor).toBe(0);

    const withShield = characterWithEquipment(withRing, "offHand", {
      id: "shield",
      name: "Shield",
      width: 2,
      height: 2,
      rarity: "gray",
      kind: "shield",
      slot: "offHand",
      bonuses: { armor: 4, threat: 50 },
    });
    expect(withShield.stats.armor).toBe(4);
    expect(withShield.stats.threat).toBe(1.5);
  });

  it("copies the cached stats onto field units so combat can mutate health freely", () => {
    const world = new World(DEFAULT_GROUP);
    const tank = DEFAULT_GROUP[0];
    const spawned = world.units.find((u) => u.side === "friendly" && u.role === "tank")!;
    expect(spawned.stats.maxHealth).toBe(tank.stats.maxHealth);
    expect(spawned.stats.attackPower).toBe(tank.stats.attackPower);
    spawned.stats.health = 10;
    expect(tank.stats.health).toBe(tank.stats.maxHealth);
  });

  it("keeps the default five-man roles", () => {
    expect(DEFAULT_GROUP.map((member) => member.role)).toEqual(["tank", "dps", "dps", "dps", "healer"]);
  });
});
