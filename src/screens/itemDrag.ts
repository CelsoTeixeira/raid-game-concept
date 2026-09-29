import { useEffect, useRef, useState, type RefObject } from "react";
import type { EquippedItem, EquipmentSlot } from "../sim/character";
import { BAG_COLUMNS, BAG_ROWS, type InventoryItem, type InventoryPlacement } from "../sim/inventory";

export type DragSource =
  | { from: "bag"; item: InventoryItem }
  | { from: "slot"; item: EquippedItem; slot: EquipmentSlot };

export type DropTarget =
  | { to: "bag"; placement: InventoryPlacement }
  | { to: "slot"; slot: EquipmentSlot }
  | { to: "trash" }
  | null;

export type ItemDrag = {
  source: DragSource;
  pointerId: number;
  grabOffsetX: number;
  grabOffsetY: number;
  target: DropTarget;
};

export type ItemDragHandlers = {
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  onLostPointerCapture: () => void;
};

export type StartItemDrag = (event: React.PointerEvent<HTMLElement>, source: DragSource) => void;

function sameTarget(a: DropTarget, b: DropTarget): boolean {
  if (a === null || b === null) return a === b;
  if (a.to === "slot") return b.to === "slot" && a.slot === b.slot;
  if (a.to === "trash") return b.to === "trash";
  return b.to === "bag" && a.placement.x === b.placement.x && a.placement.y === b.placement.y;
}

/**
 * One pointer drag shared by the bag grid and the equipment slots.
 * Slots mark themselves with `data-equipment-slot`, the trash with `data-item-trash`; the bag target comes from `boardRef`.
 */
export function useItemDrag(
  boardRef: RefObject<HTMLDivElement | null>,
  onDrop: (source: DragSource, target: NonNullable<DropTarget>) => void,
) {
  const [drag, setDrag] = useState<ItemDrag | null>(null);
  const dragRef = useRef<ItemDrag | null>(null);
  const sourceRef = useRef<HTMLElement | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const update = (next: ItemDrag | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const cancel = () => {
    const active = dragRef.current;
    const source = sourceRef.current;
    sourceRef.current = null;
    update(null);
    if (active && source?.hasPointerCapture(active.pointerId)) {
      source.releasePointerCapture(active.pointerId);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dragRef.current) return;
      event.preventDefault();
      cancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      cancel();
    };
  }, []);

  const targetAt = (clientX: number, clientY: number, active: ItemDrag): DropTarget => {
    const hit = document.elementFromPoint(clientX, clientY);
    if (hit?.closest("[data-item-trash]")) return { to: "trash" };
    const slotElement = hit?.closest<HTMLElement>("[data-equipment-slot]");
    if (slotElement) return { to: "slot", slot: slotElement.dataset.equipmentSlot as EquipmentSlot };

    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    if (clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) return null;

    const column = Math.floor((clientX - rect.left) / (rect.width / BAG_COLUMNS));
    const row = Math.floor((clientY - rect.top) / (rect.height / BAG_ROWS));
    return { to: "bag", placement: { x: column - active.grabOffsetX, y: row - active.grabOffsetY } };
  };

  const start: StartItemDrag = (event, source) => {
    if (event.button !== 0 || dragRef.current) return;

    const { item } = source;
    let grabOffsetX = Math.floor(item.width / 2);
    let grabOffsetY = Math.floor(item.height / 2);
    if (source.from === "bag") {
      const rect = event.currentTarget.getBoundingClientRect();
      const cellWidth = rect.width / item.width;
      const cellHeight = rect.height / item.height;
      grabOffsetX = Math.min(item.width - 1, Math.max(0, Math.floor((event.clientX - rect.left) / cellWidth)));
      grabOffsetY = Math.min(item.height - 1, Math.max(0, Math.floor((event.clientY - rect.top) / cellHeight)));
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    sourceRef.current = event.currentTarget;
    update({
      source,
      pointerId: event.pointerId,
      grabOffsetX,
      grabOffsetY,
      target:
        source.from === "bag"
          ? { to: "bag", placement: { x: source.item.x, y: source.item.y } }
          : { to: "slot", slot: source.slot },
    });
  };

  const handlers: ItemDragHandlers = {
    onPointerMove: (event) => {
      const active = dragRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const target = targetAt(event.clientX, event.clientY, active);
      if (sameTarget(target, active.target)) return;
      update({ ...active, target });
    },
    onPointerUp: (event) => {
      const active = dragRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      cancel();
      if (active.target) onDropRef.current(active.source, active.target);
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
  };

  return { drag, start, handlers };
}
