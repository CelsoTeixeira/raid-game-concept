import { ItemIconImage } from "./ItemIcon";
import type { ItemDrag } from "./itemDrag";

/** The dragged item under the pointer, so it stays visible outside the bag. `cellSize` matches the bag's cells. */
export function DragGhost({ drag, cellSize }: { drag: ItemDrag | null; cellSize: number }) {
  if (!drag) return null;
  const { item } = drag.source;
  return (
    <div
      className="drag-ghost"
      data-rarity={item.rarity}
      aria-hidden="true"
      style={{
        left: drag.x - (drag.grabOffsetX + 0.5) * cellSize,
        top: drag.y - (drag.grabOffsetY + 0.5) * cellSize,
        width: item.width * cellSize,
        height: item.height * cellSize,
      }}
    >
      <ItemIconImage item={item} scale={2} />
    </div>
  );
}
