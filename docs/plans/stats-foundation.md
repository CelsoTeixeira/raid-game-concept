# Stats and items foundation

Status: steps 1–4 implemented 2026-09-27, pending playtest and tuning. Old saves reset
(`raid-game.group.v4`, `raid-game.bag.v2`).

Tuning knobs: `src/sim/stats.ts` (per-attribute rates, armor half point, base roll),
`src/sim/gearKinds.ts` (weapon profiles, armor/threat/healing bases),
`src/sim/items.ts` (rarity budget and trait scale), `src/sim/balance.ts` (heal range/threshold).

## Goal

Stats and gear are the foundation. Classes and specs are removed for now; they return later as
ability loadouts once spells/abilities exist.

- **Stats and gear** decide what a character *can* do: health, damage, speed, range, healing,
  mana, armor, threat, cleave.
- **Role** is a behavior order picked on the group screen. It decides what the unit *tries* to do
  and grants no stats.
- Mismatches are allowed and just play worse (glass-cannon tank, healer without healing gear).

## Character

```ts
type Character = {
  id: string;
  baseAttributes: Attributes; // rolled per character from a seed
  equipment: Equipment;
  role: Role; // "tank" | "dps" | "healer" — behavior only
  // cache, rebuilt by refreshCombat on gear/role/base changes
  attributes: Attributes; // base + gear
  stats: Stats;
};
```

No `unitClass`, `subclass`, `RangeType`, or `CLASS_SPECS`.

## Derived stats (same rules for everyone)

| Source | Drives |
|---|---|
| Vitality | max health |
| Main-hand weapon | scaling attribute, base damage, attack speed, attack range, cleave |
| Weapon scaling attribute | attack power (`weapon damage + attribute`) |
| Agility | attack speed, movement speed |
| Intelligence | max mana, mana regen, heal power (only when gear grants healing) |
| Gear armor | percentage mitigation `armor / (armor + K)` |
| Gear threat | threat multiplier; threat written = damage × multiplier |
| Gear healing | heal power = healing + intelligence (0 without healing gear) |

No weapon: weak strength-scaled melee attack.

Enemies go through the same pipeline (attributes + a natural weapon).

## Role behavior

- **Tank**: prefer enemies that are attacking allies; otherwise nearest. Later: move to gather
  enemies (needs movement AI, separate step).
- **DPS**: attack nearest enemy in range.
- **Healer**: heal the most-hurt ally below a health threshold when it has heal power and mana;
  otherwise attack.
- Player heal orders work for any unit with heal power.

## Items

- Items carry a `kind` (sword, axe, mace, dagger, bow, staff, wand, shield, tome, pants, chest,
  amulet, ring). Weapon profile (scaling, damage, speed, range, cleave) comes from the kind.
- Rolled bonuses: primary attributes by rarity budget, plus armor (chest, pants, shield),
  threat (shield), healing (wand, tome), scaled by rarity.
- Item slot `ring` fits `ring1` / `ring2` equipment slots.
- Unique ids for rolled items; loading drops only invalid entries and dedupes ids across bag and
  equipment.

## Steps

1. Stats core: `src/sim/stats.ts`, character refactor, remove classes/specs, new save versions
   (no legacy migration; old saves reset).
2. Combat on derived stats: range, threat, cleave, healing; role picks targets and priorities.
   Formation/HUD/orders/enemies updated.
3. Items: kinds, weapon profiles, armor/threat/healing rolls, unique ids, forgiving loads.
4. UI: group screen role picker, base-attribute reroll, derived stats, role/gear mismatch hints;
   field sprites from equipped gear.

## Later

- Tank gathering / positioning AI.
- Abilities and spells, then specs as ability loadouts with stat affinities.
- Stat or item sources of extra range.
