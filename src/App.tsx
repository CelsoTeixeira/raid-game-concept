import { useEffect, useState } from "react";
import { loadPersistedGroup, persistGroup, replaceGroupMember } from "./sim/group";
import { moveInventoryItem, STARTER_BAG, type InventoryPlacement } from "./sim/inventory";
import { DungeonScreen } from "./screens/DungeonScreen";
import { FieldScreen } from "./screens/FieldScreen";
import { GroupScreen } from "./screens/GroupScreen";
import { StartScreen } from "./screens/StartScreen";

export function App() {
  const [screen, setScreen] = useState<"start" | "group" | "field" | "dungeon">("start");
  const [group, setGroup] = useState(loadPersistedGroup);
  const [bag, setBag] = useState(STARTER_BAG);

  useEffect(() => {
    persistGroup(group);
  }, [group]);

  const moveBagItem = (itemId: string, placement: InventoryPlacement) => {
    setBag((currentBag) => moveInventoryItem(currentBag, itemId, placement));
  };

  if (screen === "start") {
    return (
      <StartScreen onPlay={() => setScreen("group")} onDungeon={() => setScreen("dungeon")} />
    );
  }
  if (screen === "dungeon") {
    return <DungeonScreen onLeave={() => setScreen("start")} />;
  }
  if (screen === "group") {
    return (
      <GroupScreen
        group={group}
        bag={bag}
        onBack={() => setScreen("start")}
        onEnterField={() => setScreen("field")}
        onMoveBagItem={moveBagItem}
        onChangeMember={(index, member) => setGroup((current) => replaceGroupMember(current, index, member))}
      />
    );
  }
  return <FieldScreen group={group} onLeave={() => setScreen("group")} />;
}
