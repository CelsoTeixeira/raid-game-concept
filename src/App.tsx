import { useEffect, useState } from "react";
import type { DungeonEncounter } from "./sim/dungeonWorld";
import { DEFAULT_GROUP } from "./sim/group";
import {
  equipGuildItem,
  loadPersistedGuild,
  moveStorageItem,
  persistGuild,
  recruitFirstCharacter,
  unequipGuildItem,
  type GuildEquipResult,
} from "./sim/guild";
import type { InventoryPlacement } from "./sim/inventory";
import { mulberry32 } from "./sim/items";
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

  useEffect(() => {
    persistGuild(guild);
  }, [guild]);

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
        onEquipItem={(characterId, itemId, slot) =>
          applyGuildResult(equipGuildItem(guild, characterId, itemId, slot))
        }
        onUnequipItem={(characterId, slot, placement) =>
          applyGuildResult(unequipGuildItem(guild, characterId, slot, placement))
        }
        onPlay={() => setScreen("groupSelect")}
        onBack={() => setScreen("start")}
      />
    );
  }
  if (screen === "groupSelect") {
    return <GroupSelectScreen guild={guild} onBack={() => setScreen("guild")} />;
  }
  if (screen === "dungeon") {
    return (
      <DungeonScreen
        group={DEFAULT_GROUP}
        encounter={encounter}
        onLeave={() => setScreen("start")}
        onStartGame={(nextEncounter) => {
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
  return <FieldScreen group={DEFAULT_GROUP} encounter={encounter!} onLeave={() => setScreen("dungeon")} />;
}
