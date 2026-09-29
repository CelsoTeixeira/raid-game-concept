import { useEffect, useState } from "react";
import { DungeonWorld, type DungeonEncounter } from "./sim/dungeonWorld";
import { DEFAULT_GROUP } from "./sim/group";
import type { MapSize } from "./sim/dungeon";
import {
  destroyEquippedItem,
  destroyStorageItem,
  equipGuildItem,
  loadPersistedGuild,
  moveStorageItem,
  persistGuild,
  recruitFirstCharacter,
  unequipGuildItem,
  type GuildEquipResult,
  type GuildCharacter,
} from "./sim/guild";
import type { InventoryPlacement } from "./sim/inventory";
import { mulberry32 } from "./sim/items";
import { addDebugGear } from "./sim/debugGear";
import { openStarterChest } from "./sim/starterChest";
import { ROLE_LABELS } from "./sim/character";
import { CharacterDebugScreen } from "./screens/CharacterDebugScreen";
import { DungeonScreen } from "./screens/DungeonScreen";
import { FieldScreen } from "./screens/FieldScreen";
import { GroupSelectScreen } from "./screens/GroupSelectScreen";
import { GuildScreen } from "./screens/GuildScreen";
import { ItemDebugScreen } from "./screens/ItemDebugScreen";
import { StartScreen } from "./screens/StartScreen";

type Screen = "start" | "guild" | "groupSelect" | "field" | "dungeon" | "items" | "characters";

export function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [guild, setGuild] = useState(loadPersistedGuild);
  const [encounter, setEncounter] = useState<DungeonEncounter | undefined>();
  const [pickedCharacterIds, setPickedCharacterIds] = useState<string[]>([]);
  const [groupMapSize, setGroupMapSize] = useState<MapSize>("medium");
  const [fieldGroup, setFieldGroup] = useState(DEFAULT_GROUP);
  const [fieldReturnScreen, setFieldReturnScreen] = useState<"dungeon" | "groupSelect">("dungeon");

  useEffect(() => {
    persistGuild(guild);
  }, [guild]);

  useEffect(() => {
    const guildCharacterIds = new Set(guild.characters.map((character) => character.id));
    setPickedCharacterIds((current) => current.filter((id) => guildCharacterIds.has(id)));
  }, [guild.characters]);

  const moveGuildStorageItem = (itemId: string, placement: InventoryPlacement) => {
    setGuild((current) => moveStorageItem(current, itemId, placement));
  };

  const applyGuildResult = (result: GuildEquipResult): string | null => {
    if (!result.ok) return result.reason;
    setGuild(result.guild);
    return null;
  };

  if (screen === "start") {
    return (
      <StartScreen
        onPlay={() => setScreen("guild")}
        onDungeon={() => {
          setEncounter(undefined);
          setScreen("dungeon");
        }}
        onItems={() => setScreen("items")}
        onCharacters={() => setScreen("characters")}
      />
    );
  }
  if (screen === "guild") {
    return (
      <GuildScreen
        guild={guild}
        onMoveStorageItem={moveGuildStorageItem}
        onRecruit={() => setGuild((current) => recruitFirstCharacter(current, mulberry32(Date.now())))}
        onOpenStarterChest={() => {
          const result = openStarterChest(guild, mulberry32(Date.now()));
          if (!result.ok) return result.reason;
          setGuild(result.guild);
          const received = result.items.map(({ role, item }) => `${item.name} (${ROLE_LABELS[role]})`);
          return `Starter chest: ${received.join(", ")}. Open a character to equip them.`;
        }}
        onAddDebugGear={(requests) => {
          const result = addDebugGear(guild, requests, mulberry32(Date.now()));
          setGuild(result.guild);
          const added = result.added.map((item) => item.name).join(", ");
          const skipped = result.skipped > 0 ? `${result.skipped} did not fit in storage.` : "";
          return [added ? `Added ${added}.` : "", skipped].filter(Boolean).join(" ");
        }}
        onEquipItem={(characterId, itemId, slot) =>
          applyGuildResult(equipGuildItem(guild, characterId, itemId, slot))
        }
        onUnequipItem={(characterId, slot, placement) =>
          applyGuildResult(unequipGuildItem(guild, characterId, slot, placement))
        }
        onDestroyStorageItem={(itemId) => setGuild((current) => destroyStorageItem(current, itemId))}
        onDestroyEquippedItem={(characterId, slot) =>
          setGuild((current) => destroyEquippedItem(current, characterId, slot))
        }
        onPlay={() => setScreen("groupSelect")}
        onBack={() => setScreen("start")}
      />
    );
  }
  if (screen === "groupSelect") {
    return (
      <GroupSelectScreen
        guild={guild}
        pickedIds={pickedCharacterIds}
        mapSize={groupMapSize}
        onPick={(characterId) =>
          setPickedCharacterIds((current) =>
            current.length >= 5 || current.includes(characterId) ? current : [...current, characterId],
          )
        }
        onRemove={(characterId) => setPickedCharacterIds((current) => current.filter((id) => id !== characterId))}
        onMapSizeChange={setGroupMapSize}
        onStart={(group: GuildCharacter[], size) => {
          setFieldGroup(group);
          setFieldReturnScreen("groupSelect");
          setEncounter(new DungeonWorld(undefined, size).encounter());
          setScreen("field");
        }}
        onBack={() => setScreen("guild")}
      />
    );
  }
  if (screen === "dungeon") {
    return (
      <DungeonScreen
        group={DEFAULT_GROUP}
        encounter={encounter}
        onLeave={() => setScreen("start")}
        onStartGame={(nextEncounter) => {
          setFieldGroup(DEFAULT_GROUP);
          setFieldReturnScreen("dungeon");
          setEncounter(nextEncounter);
          setScreen("field");
        }}
      />
    );
  }
  if (screen === "items") {
    return <ItemDebugScreen onBack={() => setScreen("start")} />;
  }
  if (screen === "characters") {
    return <CharacterDebugScreen onBack={() => setScreen("start")} />;
  }
  return <FieldScreen group={fieldGroup} encounter={encounter!} onLeave={() => setScreen(fieldReturnScreen)} />;
}
