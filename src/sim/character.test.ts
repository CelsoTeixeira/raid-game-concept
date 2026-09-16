import { describe, expect, it } from "vitest";
import { characterWithEquipment, characterWithSpec, createCharacter } from "./character";
import { memberRole } from "./classes";
import { DEFAULT_GROUP } from "./group";
import { World } from "./world";

describe("cached combat stats", () => {
  it("stores combat numbers on the character when class or spec changes", () => {
    const tank = createCharacter({ unitClass: "paladin", subclass: "protection" }, "test-tank");
    expect(tank.stats.maxHealth).toBe(220);
    expect(tank.stats.attackPower).toBe(5);
    expect(tank.role).toBe("tank");

    const holy = characterWithSpec(tank, "holy");
    expect(holy.id).toBe(tank.id);
    expect(holy.role).toBe("healer");
    expect(holy.stats.magicPower).toBe(22);
    expect(holy.stats.maxHealth).toBe(100);
  });

  it("rebuilds the cache when gear is equipped, not during combat ticks", () => {
    const arms = createCharacter({ unitClass: "warrior", subclass: "arms" }, "test-arms");
    const bareAp = arms.stats.attackPower;
    const bareHp = arms.stats.maxHealth;

    const withSword = characterWithEquipment(arms, "mainHand", {
      id: "sword",
      name: "Sword",
      bonuses: { strength: 2 },
    });
    expect(withSword.attributes.strength).toBe(arms.attributes.strength + 2);
    expect(withSword.stats.attackPower).toBeGreaterThan(bareAp);

    const withRing = characterWithEquipment(withSword, "ring1", {
      id: "ring",
      name: "Ring",
      bonuses: { vitality: 1 },
    });
    expect(withRing.stats.maxHealth).toBe(bareHp + 10);
    expect(withRing.stats.armor).toBe(arms.stats.armor);

    const withShield = characterWithEquipment(withRing, "offHand", {
      id: "shield",
      name: "Shield",
      bonuses: { armor: 4 },
    });
    expect(withShield.stats.armor).toBe(arms.stats.armor + 4);
  });

  it("copies the cached stats onto field units so combat can mutate health freely", () => {
    const world = new World(DEFAULT_GROUP);
    const paladin = DEFAULT_GROUP[0];
    const spawned = world.units.find((u) => u.unitClass === "paladin")!;
    expect(spawned.stats.maxHealth).toBe(paladin.stats.maxHealth);
    expect(spawned.stats.attackPower).toBe(paladin.stats.attackPower);
    spawned.stats.health = 10;
    expect(paladin.stats.health).toBe(paladin.stats.maxHealth);
  });

  it("keeps the default five-man roles", () => {
    expect(DEFAULT_GROUP.map(memberRole)).toEqual(["tank", "dps", "dps", "dps", "healer"]);
  });
});
