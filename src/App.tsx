import { useEffect, useState } from "react";
import { loadPersistedGroup, persistGroup } from "./sim/group";
import { moveInventoryItem, STARTER_BAG, type InventoryPlacement } from "./sim/inventory";
import { FieldScreen } from "./screens/FieldScreen";
import { GroupScreen } from "./screens/GroupScreen";
import { StartScreen } from "./screens/StartScreen";

export function App() {
  const [screen, setScreen] = useState<"start" | "group" | "field">("start");
  const [group] = useState(loadPersistedGroup);
  const [bag, setBag] = useState(STARTER_BAG);

  useEffect(() => {
    persistGroup(group);
  }, [group]);

  const moveBagItem = (itemId: string, placement: InventoryPlacement) => {
    setBag((currentBag) => moveInventoryItem(currentBag, itemId, placement));
  };

  if (screen === "start") return <StartScreen onPlay={() => setScreen("group")} />;
  if (screen === "group") {
    return (
      <GroupScreen
        group={group}
        bag={bag}
        onBack={() => setScreen("start")}
        onEnterField={() => setScreen("field")}
        onMoveBagItem={moveBagItem}
      />
    );
  }
  return <FieldScreen group={group} onLeave={() => setScreen("group")} />;
}
