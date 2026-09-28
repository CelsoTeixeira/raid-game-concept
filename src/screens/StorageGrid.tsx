import type { RefObject } from "react";
import { EQUIPMENT_SLOT_LABELS, slotsForItem } from "../sim/character";
import {
  BAG_COLUMNS,
  BAG_ROWS,
  isInventoryPlacementValid,
  itemFitsAt,
  type InventoryItem,
  type InventoryPlacement,
} from "../sim/inventory";
import { GEAR_KINDS } from "../sim/gearKinds";
import { formatItemBonuses, formatItemBonusesShort, formatWeapon } from "../sim/items";
import type { ItemDrag, ItemDragHandlers, StartItemDrag } from "./itemDrag";

const KEY_OFFSETS: Record<string, InventoryPlacement> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

function itemStyle(item: Pick<InventoryItem, "x" | "y" | "width" | "height">): React.CSSProperties {
  return {
    left: `${(item.x / BAG_COLUMNS) * 100}%`,
    top: `${(item.y / BAG_ROWS) * 100}%`,
    width: `${(item.width / BAG_COLUMNS) * 100}%`,
    height: `${(item.height / BAG_ROWS) * 100}%`,
  };
}

function isDropValid(items: InventoryItem[], drag: ItemDrag, placement: InventoryPlacement): boolean {
  return drag.source.from === "bag"
    ? isInventoryPlacementValid(items, drag.source.item.id, placement)
    : itemFitsAt(items, drag.source.item, placement);
}

function dragStatus(items: InventoryItem[], drag: ItemDrag): string {
  const { item } = drag.source;
  const { target } = drag;
  if (target?.to === "bag") {
    const valid = isDropValid(items, drag, target.placement);
    return `${item.name}: ${valid ? "valid placement" : "blocked placement"}. Release to place or press Escape to cancel.`;
  }
  if (target?.to === "slot" && drag.source.from === "bag") {
    const label = EQUIPMENT_SLOT_LABELS[target.slot];
    return slotsForItem(item.slot).includes(target.slot)
      ? `${item.name}: release to equip in ${label}.`
      : `${item.name} does not fit the ${label} slot.`;
  }
  return drag.source.from === "slot"
    ? `${item.name}: drop in the bag to unequip, or press Escape to cancel.`
    : `${item.name}: drop in the bag or on a matching slot, or press Escape to cancel.`;
}

/** Guild storage grid. Equipping is only offered when `onEquipItem` is given and `canEquip` is on. */
export function StorageGrid({
  items,
  drag,
  boardRef,
  startDrag,
  dragHandlers,
  canEquip = false,
  notice = null,
  onMoveItem,
  onEquipItem,
}: {
  items: InventoryItem[];
  drag: ItemDrag | null;
  boardRef: RefObject<HTMLDivElement | null>;
  startDrag: StartItemDrag;
  dragHandlers: ItemDragHandlers;
  canEquip?: boolean;
  notice?: string | null;
  onMoveItem: (itemId: string, placement: InventoryPlacement) => void;
  onEquipItem?: (itemId: string) => void;
}) {
  const equip = canEquip ? onEquipItem : undefined;
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, item: InventoryItem) => {
    if (event.key === "Enter" && equip) {
      event.preventDefault();
      equip(item.id);
      return;
    }
    const offset = KEY_OFFSETS[event.key];
    if (!offset) return;

    event.preventDefault();
    onMoveItem(item.id, { x: item.x + offset.x, y: item.y + offset.y });
  };

  const bagPreview = drag?.target?.to === "bag" ? drag.target.placement : null;
  const previewIsValid = Boolean(drag && bagPreview && isDropValid(items, drag, bagPreview));
  const idleStatus =
    items.length === 0
      ? "Storage is empty."
      : equip
        ? "Drag to rearrange or onto a matching slot. Double-click or press Enter to equip."
        : "Drag items to rearrange them, or focus one and use the arrow keys.";

  return (
    <section className="group-bag" aria-labelledby="storage-title">
      <div className="group-bag-heading">
        <div>
          <h2 id="storage-title">Storage</h2>
          <p>
            {BAG_COLUMNS} × {BAG_ROWS} slots
          </p>
        </div>
        <span className="group-bag-count">{items.length} items</span>
      </div>
      <div
        className="group-bag-board"
        ref={boardRef}
        aria-label={`Storage, ${BAG_COLUMNS} columns by ${BAG_ROWS} rows`}
      >
        {drag && bagPreview ? (
          <div
            className={`group-bag-preview ${previewIsValid ? "is-valid" : "is-invalid"}`}
            style={{
              ...itemStyle({ ...drag.source.item, ...bagPreview }),
              gridTemplateColumns: `repeat(${drag.source.item.width}, minmax(0, 1fr))`,
            }}
            aria-hidden="true"
          >
            {Array.from({ length: drag.source.item.width * drag.source.item.height }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        ) : null}
        {items.map((item) => {
          const bonusText = [formatWeapon(item.kind), formatItemBonuses(item.bonuses)].filter(Boolean).join(", ");
          const shortBonuses = formatItemBonusesShort(item.bonuses);
          const isDragging = drag?.source.from === "bag" && drag.source.item.id === item.id;
          return (
            <button
              className={`group-bag-item ${isDragging ? "is-dragging" : ""}`}
              data-rarity={item.rarity}
              key={item.id}
              type="button"
              style={itemStyle(item)}
              aria-label={`${item.name}, ${item.rarity} ${GEAR_KINDS[item.kind].label.toLowerCase()}, ${bonusText || "no bonuses"}, ${item.width} by ${item.height} slots, column ${item.x + 1}, row ${item.y + 1}. Use arrow keys to move${equip ? ", Enter to equip" : ""}.`}
              onKeyDown={(event) => handleKeyDown(event, item)}
              onPointerDown={(event) => startDrag(event, { from: "bag", item })}
              onDoubleClick={() => equip?.(item.id)}
              {...dragHandlers}
            >
              <span className="group-bag-item-name">{item.name}</span>
              <span className="item-kind">{GEAR_KINDS[item.kind].label}</span>
              {shortBonuses ? <span className="group-bag-item-stats">{shortBonuses}</span> : null}
            </button>
          );
        })}
      </div>
      <p className="group-bag-status" aria-live="polite">
        {drag ? dragStatus(items, drag) : (notice ?? idleStatus)}
      </p>
    </section>
  );
}
