import { useRef, useState } from "react";
import { outfitFromEquipment } from "../art";
import type { EquipmentSlot } from "../sim/character";
import type { DebugGearRequest } from "../sim/debugGear";
import { FIRST_RECRUIT_RARITY, type Guild, type GuildCharacter } from "../sim/guild";
import { canOpenStarterChest, STARTER_CHEST_RARITY } from "../sim/starterChest";
import { RARITY_LABELS, type InventoryPlacement } from "../sim/inventory";
import { formatName, REGION_LABELS, SEX_LABELS } from "../sim/names";
import { PRIMARY_STATS, STAT_LABELS } from "../sim/stats";
import { ArtCharacter } from "./ArtCharacter";
import { DebugGearPanel } from "./DebugGearPanel";
import { GuildCharacterPanel } from "./GuildCharacterPanel";
import { useItemDrag, type DragSource, type DropTarget } from "./itemDrag";
import { StorageGrid } from "./StorageGrid";

function GuildCharacterCard({ character, onOpen }: { character: GuildCharacter; onOpen: () => void }) {
  return (
    <li>
      <button className="member-card" data-rarity={character.rarity} type="button" onClick={onOpen}>
        <ArtCharacter sex={character.sex} look={character.look} outfit={outfitFromEquipment(character.equipment)} scale={2} />
        <strong>{formatName(character.name)}</strong>
        <span>
          {RARITY_LABELS[character.rarity]} · {SEX_LABELS[character.sex]} · {REGION_LABELS[character.region]}
        </span>
        <span>
          {PRIMARY_STATS.map((stat) => `${STAT_LABELS[stat].slice(0, 3)} ${character.baseAttributes[stat]}`).join(" · ")}
        </span>
      </button>
    </li>
  );
}

export function GuildScreen({
  guild,
  onMoveStorageItem,
  onRecruit,
  onOpenStarterChest,
  onAddDebugGear,
  onEquipItem,
  onUnequipItem,
  onDestroyStorageItem,
  onDestroyEquippedItem,
  onPlay,
  onBack,
}: {
  guild: Guild;
  onMoveStorageItem: (itemId: string, placement: InventoryPlacement) => void;
  /** Rolls the first character; only offered while the guild is empty. */
  onRecruit: () => void;
  /** Opens the one-time starter chest. Returns the notice to show. */
  onOpenStarterChest: () => string;
  /** Debug: generates the requested gear into storage. Returns the notice to show. */
  onAddDebugGear: (requests: DebugGearRequest[]) => string;
  /** Returns why the item could not be equipped, or null on success. */
  onEquipItem: (characterId: string, itemId: string, slot?: EquipmentSlot) => string | null;
  /** Returns why the item could not be unequipped, or null on success. */
  onUnequipItem: (characterId: string, slot: EquipmentSlot, placement?: InventoryPlacement) => string | null;
  onDestroyStorageItem: (itemId: string) => void;
  onDestroyEquippedItem: (characterId: string, slot: EquipmentSlot) => void;
  onPlay: () => void;
  onBack: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const selected = guild.characters.find((character) => character.id === selectedId);

  const equip = (itemId: string, slot?: EquipmentSlot) => {
    if (!selected) return;
    setNotice(onEquipItem(selected.id, itemId, slot));
  };

  const unequip = (slot: EquipmentSlot, placement?: InventoryPlacement) => {
    if (!selected) return;
    setNotice(onUnequipItem(selected.id, slot, placement));
  };

  const handleDrop = (source: DragSource, target: NonNullable<DropTarget>) => {
    if (target.to === "trash") {
      if (source.from === "bag") onDestroyStorageItem(source.item.id);
      else if (selected) onDestroyEquippedItem(selected.id, source.slot);
      setNotice(`Destroyed ${source.item.name}.`);
      return;
    }
    if (source.from === "bag") {
      if (target.to === "slot") {
        equip(source.item.id, target.slot);
      } else if (target.placement.x !== source.item.x || target.placement.y !== source.item.y) {
        setNotice(null);
        onMoveStorageItem(source.item.id, target.placement);
      }
      return;
    }
    if (target.to === "bag") unequip(source.slot, target.placement);
  };

  const { drag, start, handlers } = useItemDrag(boardRef, handleDrop);

  const openCharacter = (id: string | null) => {
    setSelectedId(id);
    setNotice(null);
  };

  return (
    <main className="screen group-screen">
      <h1>Guild</h1>
      <p>The characters and items you have collected. Clear levels to earn more.</p>

      <div className="group-workspace guild-workspace">
        <section className="group-roster" aria-labelledby="guild-roster-title">
          {selected ? (
            <GuildCharacterPanel
              character={selected}
              drag={drag}
              startDrag={start}
              dragHandlers={handlers}
              onUnequip={(slot) => unequip(slot)}
              onClose={() => openCharacter(null)}
            />
          ) : (
            <>
              <div className="group-bag-heading">
                <div>
                  <h2 id="guild-roster-title">Characters</h2>
                  <p>Everyone in the guild. Open one to manage its gear.</p>
                </div>
                <span className="group-bag-count">{guild.characters.length} characters</span>
              </div>
              {canOpenStarterChest(guild) ? (
                <div className="guild-chest">
                  <p>
                    Starter chest: one {RARITY_LABELS[STARTER_CHEST_RARITY].toLowerCase()} item for each role (tank,
                    dps, healer).
                  </p>
                  <button type="button" onClick={() => setNotice(onOpenStarterChest())}>
                    Open chest
                  </button>
                </div>
              ) : null}
              {guild.characters.length === 0 ? (
                <div className="guild-empty">
                  <p>No characters yet. Roll one to start your guild.</p>
                  <button type="button" onClick={onRecruit}>
                    Roll a {RARITY_LABELS[FIRST_RECRUIT_RARITY].toLowerCase()} character
                  </button>
                </div>
              ) : (
                <ul className="member-list guild-character-list">
                  {guild.characters.map((character) => (
                    <GuildCharacterCard
                      character={character}
                      key={character.id}
                      onOpen={() => openCharacter(character.id)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <div className="guild-storage-column">
          <StorageGrid
            items={guild.storage}
            drag={drag}
            boardRef={boardRef}
            startDrag={start}
            dragHandlers={handlers}
            canEquip={selected !== undefined}
            notice={notice}
            onMoveItem={onMoveStorageItem}
            onEquipItem={(itemId) => equip(itemId)}
            showTrash
          />
          <DebugGearPanel onAdd={(requests) => setNotice(onAddDebugGear(requests))} />
        </div>
      </div>

      <div className="screen-actions">
        <button type="button" onClick={onPlay}>
          Play
        </button>
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </main>
  );
}
