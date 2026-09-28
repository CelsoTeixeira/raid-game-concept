import { useRef, useState } from "react";
import { appearanceFrames, getMemberAppearance } from "../appearance";
import type { EquipmentSlot } from "../sim/character";
import { FIRST_RECRUIT_RARITY, type Guild, type GuildCharacter } from "../sim/guild";
import { RARITY_LABELS, type InventoryPlacement } from "../sim/inventory";
import { formatName, REGION_LABELS, SEX_LABELS } from "../sim/names";
import { PRIMARY_STATS, STAT_LABELS } from "../sim/stats";
import { GuildCharacterPanel } from "./GuildCharacterPanel";
import { useItemDrag, type DragSource, type DropTarget } from "./itemDrag";
import { SpriteStack } from "./SpriteStack";
import { StorageGrid } from "./StorageGrid";

function GuildCharacterCard({
  character,
  index,
  onOpen,
}: {
  character: GuildCharacter;
  index: number;
  onOpen: () => void;
}) {
  return (
    <li>
      <button className="member-card" data-rarity={character.rarity} type="button" onClick={onOpen}>
        <SpriteStack frames={appearanceFrames(getMemberAppearance(character, index))} size={64} />
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
  onEquipItem,
  onUnequipItem,
  onPlay,
  onBack,
}: {
  guild: Guild;
  onMoveStorageItem: (itemId: string, placement: InventoryPlacement) => void;
  /** Rolls the first character; only offered while the guild is empty. */
  onRecruit: () => void;
  /** Returns why the item could not be equipped, or null on success. */
  onEquipItem: (characterId: string, itemId: string, slot?: EquipmentSlot) => string | null;
  /** Returns why the item could not be unequipped, or null on success. */
  onUnequipItem: (characterId: string, slot: EquipmentSlot, placement?: InventoryPlacement) => string | null;
  onPlay: () => void;
  onBack: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const selectedIndex = guild.characters.findIndex((character) => character.id === selectedId);
  const selected = selectedIndex >= 0 ? guild.characters[selectedIndex] : undefined;

  const equip = (itemId: string, slot?: EquipmentSlot) => {
    if (!selected) return;
    setNotice(onEquipItem(selected.id, itemId, slot));
  };

  const unequip = (slot: EquipmentSlot, placement?: InventoryPlacement) => {
    if (!selected) return;
    setNotice(onUnequipItem(selected.id, slot, placement));
  };

  const handleDrop = (source: DragSource, target: NonNullable<DropTarget>) => {
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
              index={selectedIndex}
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
              {guild.characters.length === 0 ? (
                <div className="guild-empty">
                  <p>No characters yet. Roll one to start your guild.</p>
                  <button type="button" onClick={onRecruit}>
                    Roll a {RARITY_LABELS[FIRST_RECRUIT_RARITY].toLowerCase()} character
                  </button>
                </div>
              ) : (
                <ul className="member-list guild-character-list">
                  {guild.characters.map((character, index) => (
                    <GuildCharacterCard
                      character={character}
                      index={index}
                      key={character.id}
                      onOpen={() => openCharacter(character.id)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

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
        />
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
