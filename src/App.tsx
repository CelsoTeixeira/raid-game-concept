import { useState } from "react";
import { DEFAULT_GROUP } from "./sim/group";
import { FieldScreen } from "./screens/FieldScreen";
import { GroupScreen } from "./screens/GroupScreen";
import { StartScreen } from "./screens/StartScreen";

export function App() {
  const [screen, setScreen] = useState<"start" | "group" | "field">("start");

  if (screen === "start") return <StartScreen onPlay={() => setScreen("group")} />;
  if (screen === "group") {
    return (
      <GroupScreen
        group={DEFAULT_GROUP}
        onBack={() => setScreen("start")}
        onEnterField={() => setScreen("field")}
      />
    );
  }
  return <FieldScreen group={DEFAULT_GROUP} onLeave={() => setScreen("group")} />;
}
