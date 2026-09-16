import { useEffect, useState } from "react";
import { loadPersistedGroup, persistGroup, replaceGroupMember } from "./sim/group";
import { moveInventoryItem, STARTER_BAG, type InventoryPlacement } from "./sim/inventory";
import type { DungeonEncounter } from "./sim/dungeonWorld";
import { DungeonScreen } from "./screens/DungeonScreen";
import { FieldScreen } from "./screens/FieldScreen";
import { GroupScreen } from "./screens/GroupScreen";
import { StartScreen } from "./screens/StartScreen";

export function App() {
  const [screen, setScreen] = useState<"start" | "group" | "field" | "dungeon">("start");
  const [group, setGroup] = useState(loadPersistedGroup);
  const [bag, setBag] = useState(STARTER_BAG);
  const [encounter, setEncounter] = useState<DungeonEncounter | undefined>();
  const [dungeonBackScreen, setDungeonBackScreen] = useState<"start" | "group">("start");

  useEffect(() => {
    persistGroup(group);
  }, [group]);

  const moveBagItem = (itemId: string, placement: InventoryPlacement) => {
    setBag((currentBag) => moveInventoryItem(currentBag, itemId, placement));
  };

  if (screen === "start") {
    return (
      <StartScreen
        onPlay={() => setScreen("group")}
        onDungeon={() => {
          setEncounter(undefined);
          setDungeonBackScreen("start");
          setScreen("dungeon");
        }}
      />
    );
  }
  if (screen === "dungeon") {
    return (
      <DungeonScreen
        group={group}
        encounter={encounter}
        onLeave={() => setScreen(dungeonBackScreen)}
        onStartGame={(nextEncounter) => {
          setEncounter(nextEncounter);
          setScreen("field");
        }}
      />
    );
  }
  if (screen === "group") {
    return (
      <GroupScreen
        group={group}
        bag={bag}
        onBack={() => setScreen("start")}
        onEnterDungeon={() => {
          setEncounter(undefined);
          setDungeonBackScreen("group");
          setScreen("dungeon");
        }}
        onMoveBagItem={moveBagItem}
        onChangeMember={(index, member) => setGroup((current) => replaceGroupMember(current, index, member))}
      />
    );
  }
  return <FieldScreen group={group} encounter={encounter!} onLeave={() => setScreen("dungeon")} />;
}
