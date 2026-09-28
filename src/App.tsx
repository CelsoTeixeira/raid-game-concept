import { useEffect, useState } from "react";
import type { DungeonEncounter } from "./sim/dungeonWorld";
import { DEFAULT_GROUP } from "./sim/group";
import { loadPersistedGuild, moveStorageItem, persistGuild } from "./sim/guild";
import type { InventoryPlacement } from "./sim/inventory";
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
