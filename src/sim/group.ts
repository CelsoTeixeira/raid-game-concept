import { rollCharacterLook } from "../appearance";
import {
  createCharacter,
  EQUIPMENT_SLOTS,
  emptyEquipment,
  type Character,
  type Equipment,
  type EquipmentSlot,
} from "./character";
import type { ArmorFamily, GearKindId } from "./gearKinds";
import { generateGear, mulberry32 } from "./items";
import { SEXES } from "./names";
import { rollBaseAttributes } from "./stats";
import type { Role } from "./types";

export type { Character } from "./character";
export type GroupMember = Character;

type DefaultPlan = { role: Role; kinds: Partial<Record<EquipmentSlot, GearKindId>>; armor?: ArmorFamily };

const DEFAULT_PLANS: readonly DefaultPlan[] = [
  { role: "tank", kinds: { mainHand: "sword", offHand: "shield", chest: "chest" }, armor: "plate" },
  { role: "dps", kinds: { mainHand: "axe" } },
  { role: "dps", kinds: { mainHand: "dagger" } },
  { role: "dps", kinds: { mainHand: "staff" } },
  { role: "healer", kinds: { mainHand: "wand", offHand: "tome" } },
];

function defaultEquipment(index: number, plan: DefaultPlan): Equipment {
  const rng = mulberry32(1000 + index);
  const equipment = emptyEquipment();
  for (const slot of EQUIPMENT_SLOTS) {
    const kind = plan.kinds[slot];
    if (!kind) continue;
    equipment[slot] = generateGear({
      rng,
      id: `gear-default-${index + 1}-${slot}`,
      rarity: "gray",
      kind,
      armorFamily: plan.armor,
    });
  }
  return equipment;
}

/**
 * Fixed group for the dungeon sketch and tests until group selection exists: seeded rolls,
 * gray starter gear, roles picked for behavior.
 */
export const DEFAULT_GROUP: Character[] = DEFAULT_PLANS.map((plan, index) => {
  const lookRng = mulberry32(2000 + index);
  const sex = SEXES[Math.floor(lookRng.next() * SEXES.length)]!;
  return createCharacter({
    id: `char-${index + 1}`,
    role: plan.role,
    baseAttributes: rollBaseAttributes(mulberry32(index + 1)),
    equipment: defaultEquipment(index, plan),
    sex,
    look: rollCharacterLook(lookRng, sex),
  });
});
