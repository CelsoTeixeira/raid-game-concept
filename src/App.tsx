import { useEffect, useState } from "react";
import type { EquipmentSlot } from "./sim/character";
import { equipFromBag, unequipToBag, type EquipResult } from "./sim/equip";
import { loadPersistedGroup, persistGroup, replaceGroupMember } from "./sim/group";
import { loadPersistedBag, moveInventoryItem, persistBag, type InventoryPlacement } from "./sim/inventory";
import { generateStarterBag, rollItemIntoBag } from "./sim/items";
import type { DungeonEncounter } from "./sim/dungeonWorld";
import { DungeonScreen } from "./screens/DungeonScreen";
import { FieldScreen } from "./screens/FieldScreen";
import { GroupScreen } from "./screens/GroupScreen";
import { ItemDebugScreen } from "./screens/ItemDebugScreen";
import { StartScreen } from "./screens/StartScreen";

export function App() {
  const [screen, setScreen] = useState<"start" | "group" | "field" | "dungeon" | "items">("start");
  const [group, setGroup] = useState(loadPersistedGroup);
  const [bag, setBag] = useState(() => loadPersistedBag() ?? generateStarterBag(1));
  const [encounter, setEncounter] = useState<DungeonEncounter | undefined>();
  const [dungeonBackScreen, setDungeonBackScreen] = useState<"start" | "group">("start");

  useEffect(() => {
    persistGroup(group);
  }, [group]);

  useEffect(() => {
    persistBag(bag);
  }, [bag]);

  const moveBagItem = (itemId: string, placement: InventoryPlacement) => {
    setBag((currentBag) => moveInventoryItem(currentBag, itemId, placement));
  };

  const rollBagItem = () => {
    setBag((currentBag) => rollItemIntoBag(currentBag));
  };

  const applyEquip = (memberIndex: number, result: EquipResult): string | null => {
    if (!result.ok) return result.reason;
    setBag(result.bag);
    setGroup((current) => replaceGroupMember(current, memberIndex, result.character));
    return null;
  };

  const equipItem = (memberIndex: number, itemId: string, slot?: EquipmentSlot) =>
    applyEquip(memberIndex, equipFromBag(bag, group[memberIndex]!, itemId, slot));

  const unequipItem = (memberIndex: number, slot: EquipmentSlot, placement?: InventoryPlacement) =>
    applyEquip(memberIndex, unequipToBag(bag, group[memberIndex]!, slot, placement));

  if (screen === "start") {
    return (
      <StartScreen
        onPlay={() => setScreen("group")}
        onDungeon={() => {
          setEncounter(undefined);
          setDungeonBackScreen("start");
          setScreen("dungeon");
        }}
        onItems={() => setScreen("items")}
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
  if (screen === "items") {
    return <ItemDebugScreen onBack={() => setScreen("start")} />;
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
        onRollBagItem={rollBagItem}
        onEquipItem={equipItem}
        onUnequipItem={unequipItem}
        onChangeMember={(index, member) => setGroup((current) => replaceGroupMember(current, index, member))}
      />
    );
  }
  return <FieldScreen group={group} encounter={encounter!} onLeave={() => setScreen("dungeon")} />;
}
