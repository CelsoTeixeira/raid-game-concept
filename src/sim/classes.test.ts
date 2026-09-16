import { describe, expect, it } from "vitest";
import { combatStatsFrom, HEALTH_PER_VITALITY, maxHealthFrom } from "./balance";
import { getSpec, memberRole, memberWithSpec } from "./classes";
import { DEFAULT_GROUP } from "./group";
import { World } from "./world";

describe("primary stats", () => {
  it("vitality increases health", () => {
    const spec = getSpec({ unitClass: "warrior", subclass: "protection" });
    expect(maxHealthFrom(spec.attributes.vitality)).toBe(220);
    const boosted = combatStatsFrom(spec, { ...spec.attributes, vitality: spec.attributes.vitality + 2 });
    expect(boosted.maxHealth).toBe(220 + 2 * HEALTH_PER_VITALITY);
  });

  it("strength feeds warrior damage, agility feeds rogue, intelligence feeds mage", () => {
    const arms = combatStatsFrom(getSpec({ unitClass: "warrior", subclass: "arms" }));
    const rogue = combatStatsFrom(getSpec({ unitClass: "rogue", subclass: "assassination" }));
    const fire = combatStatsFrom(getSpec({ unitClass: "mage", subclass: "fire" }));
    expect(arms.attackPower).toBe(18);
    expect(rogue.attackPower).toBe(18);
    expect(fire.attackPower).toBe(15);

    const weakArms = combatStatsFrom(getSpec({ unitClass: "warrior", subclass: "arms" }), {
      vitality: 6,
      strength: 0,
      agility: 6,
      intelligence: 2,
    });
    expect(weakArms.attackPower).toBeLessThan(arms.attackPower);

    const weakRogue = combatStatsFrom(getSpec({ unitClass: "rogue", subclass: "assassination" }), {
      vitality: 6,
      strength: 4,
      agility: 0,
      intelligence: 2,
    });
    expect(weakRogue.attackPower).toBeLessThan(rogue.attackPower);

    const weakFire = combatStatsFrom(getSpec({ unitClass: "mage", subclass: "fire" }), {
      vitality: 5,
      strength: 2,
      agility: 5,
      intelligence: 0,
    });
    expect(weakFire.attackPower).toBeLessThan(fire.attackPower);
  });

  it("intelligence feeds priest and paladin heals", () => {
    const priest = combatStatsFrom(getSpec({ unitClass: "priest", subclass: "holy" }));
    const paladin = combatStatsFrom(getSpec({ unitClass: "paladin", subclass: "holy" }));
    expect(priest.magicPower).toBe(22);
    expect(paladin.magicPower).toBe(22);
    expect(combatStatsFrom(getSpec({ unitClass: "warrior", subclass: "arms" })).magicPower).toBe(0);
  });

  it("default five-man covers tank, melee dps, ranged dps, and a healer", () => {
    expect(DEFAULT_GROUP.map(memberRole)).toEqual(["tank", "dps", "dps", "dps", "healer"]);
    const world = new World();
    expect(world.units.filter((u) => u.role === "tank")).toHaveLength(1);
    expect(world.units.filter((u) => u.role === "healer")).toHaveLength(1);
    expect(world.units.filter((u) => u.role === "dps")).toHaveLength(3);
    expect(world.units.some((u) => u.unitClass === "rogue")).toBe(true);
    expect(world.units.some((u) => u.unitClass === "mage" && u.rangeType === "ranged")).toBe(true);
  });

  it("paladin can be tank, dps, or healer", () => {
    expect(memberRole(memberWithSpec("paladin", "protection"))).toBe("tank");
    expect(memberRole(memberWithSpec("paladin", "retribution"))).toBe("dps");
    expect(memberRole(memberWithSpec("paladin", "holy"))).toBe("healer");
  });
});
