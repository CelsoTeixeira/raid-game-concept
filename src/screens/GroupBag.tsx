import { useEffect, useRef, useState } from "react";
import {
  BAG_COLUMNS,
  BAG_ROWS,
  isInventoryPlacementValid,
  type InventoryItem,
  type InventoryPlacement,
} from "../sim/inventory";
import { formatItemBonuses, formatItemBonusesShort } from "../sim/items";

type DragState = {
  itemId: string;
  pointerId: number;
  grabOffsetX: number;
  grabOffsetY: number;
  preview: InventoryPlacement;
};

const KEY_OFFSETS: Record<string, InventoryPlacement> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

function itemStyle(item: InventoryItem): React.CSSProperties {
  return {
    left: `${(item.x / BAG_COLUMNS) * 100}%`,
    top: `${(item.y / BAG_ROWS) * 100}%`,
    width: `${(item.width / BAG_COLUMNS) * 100}%`,
    height: `${(item.height / BAG_ROWS) * 100}%`,
  };
}

export function GroupBag({
  items,
  onMoveItem,
  onRollItem,
}: {
  items: InventoryItem[];
  onMoveItem: (itemId: string, placement: InventoryPlacement) => void;
  onRollItem: () => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragSourceRef = useRef<HTMLButtonElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const clearDrag = () => {
    const activeDrag = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    const source = dragSourceRef.current;
    dragSourceRef.current = null;
    if (activeDrag && source?.hasPointerCapture(activeDrag.pointerId)) {
      source.releasePointerCapture(activeDrag.pointerId);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dragRef.current) return;
      event.preventDefault();
      clearDrag();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearDrag();
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>, item: InventoryItem) => {
    if (event.button !== 0 || dragRef.current) return;

    const itemRect = event.currentTarget.getBoundingClientRect();
    const itemCellWidth = itemRect.width / item.width;
    const itemCellHeight = itemRect.height / item.height;
    const grabOffsetX = Math.min(
      item.width - 1,
      Math.max(0, Math.floor((event.clientX - itemRect.left) / itemCellWidth)),
    );
    const grabOffsetY = Math.min(
      item.height - 1,
      Math.max(0, Math.floor((event.clientY - itemRect.top) / itemCellHeight)),
    );
    const nextDrag: DragState = {
      itemId: item.id,
      pointerId: event.pointerId,
      grabOffsetX,
      grabOffsetY,
      preview: { x: item.x, y: item.y },
    };

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragSourceRef.current = event.currentTarget;
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const activeDrag = dragRef.current;
    const board = boardRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId || !board) return;

    const boardRect = board.getBoundingClientRect();
    const cellWidth = boardRect.width / BAG_COLUMNS;
    const cellHeight = boardRect.height / BAG_ROWS;
    const pointerColumn = Math.floor((event.clientX - boardRect.left) / cellWidth);
    const pointerRow = Math.floor((event.clientY - boardRect.top) / cellHeight);
    const preview = {
      x: pointerColumn - activeDrag.grabOffsetX,
      y: pointerRow - activeDrag.grabOffsetY,
    };

    if (preview.x === activeDrag.preview.x && preview.y === activeDrag.preview.y) return;
    const nextDrag = { ...activeDrag, preview };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const activeDrag = dragRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;

    const isValid = isInventoryPlacementValid(items, activeDrag.itemId, activeDrag.preview);
    const placement = activeDrag.preview;
    clearDrag();
    if (isValid) onMoveItem(activeDrag.itemId, placement);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, item: InventoryItem) => {
    const offset = KEY_OFFSETS[event.key];
    if (!offset) return;

    event.preventDefault();
    onMoveItem(item.id, { x: item.x + offset.x, y: item.y + offset.y });
  };

  const draggedItem = drag ? items.find((item) => item.id === drag.itemId) : undefined;
  const previewIsValid = Boolean(
    draggedItem && drag && isInventoryPlacementValid(items, draggedItem.id, drag.preview),
  );

  return (
    <section className="group-bag" aria-labelledby="group-bag-title">
      <div className="group-bag-heading">
        <div>
          <h2 id="group-bag-title">Group bag</h2>
          <p>5 × 5 slots · gray to orange gear</p>
        </div>
        <div className="group-bag-heading-actions">
          <span className="group-bag-count">{items.length} items</span>
          <button type="button" onClick={onRollItem}>
            Roll item
          </button>
        </div>
      </div>
      <div
        className="group-bag-board"
        ref={boardRef}
        aria-label="Group bag, five columns by five rows"
      >
        {draggedItem && drag ? (
          <div
            className={`group-bag-preview ${previewIsValid ? "is-valid" : "is-invalid"}`}
            style={{
              ...itemStyle({ ...draggedItem, ...drag.preview }),
              gridTemplateColumns: `repeat(${draggedItem.width}, minmax(0, 1fr))`,
            }}
            aria-hidden="true"
          >
            {Array.from({ length: draggedItem.width * draggedItem.height }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        ) : null}
        {items.map((item) => {
          const bonusText = formatItemBonuses(item.bonuses);
          const shortBonuses = formatItemBonusesShort(item.bonuses);
          return (
            <button
              className={`group-bag-item ${drag?.itemId === item.id ? "is-dragging" : ""}`}
              data-rarity={item.rarity}
              key={item.id}
              type="button"
              style={itemStyle(item)}
              aria-label={`${item.name}, ${item.rarity}, ${bonusText || "no bonuses"}, ${item.width} by ${item.height} slots, column ${item.x + 1}, row ${item.y + 1}. Use arrow keys to move.`}
              onKeyDown={(event) => handleKeyDown(event, item)}
              onPointerDown={(event) => handlePointerDown(event, item)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={clearDrag}
              onLostPointerCapture={clearDrag}
            >
              <span className="group-bag-item-name">{item.name}</span>
              {shortBonuses ? <span className="group-bag-item-stats">{shortBonuses}</span> : null}
            </button>
          );
        })}
      </div>
      <p className="group-bag-status" aria-live="polite">
        {draggedItem && drag
          ? `${draggedItem.name}: ${previewIsValid ? "valid placement" : "blocked placement"}. Release to place or press Escape to cancel.`
          : "Drag items to rearrange them, or focus one and use the arrow keys."}
      </p>
    </section>
  );
}
