"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { flushSync } from "react-dom";
import { GripVertical } from "lucide-react";
import { cn } from "../../lib/cn";

type SortableListProps<TItem> = {
  className?: string;
  /** Stable identity for a row, also used as the React key. */
  getItemKey: (item: TItem) => string;
  /** Human readable name of a row, used for the drag handle label. */
  getItemLabel: (item: TItem) => string;
  items: TItem[];
  /** Called once a drag or a keyboard move settles on a new order. */
  onReorder: (reorderedItems: TItem[]) => void;
  renderItem: (item: TItem) => ReactNode;
};

const sortableRowAttribute = "data-sortable-key";
const autoScrollEdgeSize = 72;
const autoScrollStep = 14;
const autoScrollIntervalMs = 30;

const moveItem = <TItem,>(items: TItem[], fromIndex: number, toIndex: number) => {
  const reorderedItems = [...items];
  const [movedItem] = reorderedItems.splice(fromIndex, 1);
  reorderedItems.splice(toIndex, 0, movedItem);
  return reorderedItems;
};

// Rows are measured instead of hit-tested, so the row the pointer aims at is
// found even when it sits under the sticky app header or the pointer drifts
// sideways out of the list.
const findRowClosestToPointer = (listElement: HTMLUListElement | null, pointerY: number) => {
  const rowElements = Array.from(
    listElement?.querySelectorAll<HTMLElement>(`[${sortableRowAttribute}]`) ?? []
  );

  let closestRow: { itemKey: string; bounds: DOMRect } | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const rowElement of rowElements) {
    const itemKey = rowElement.getAttribute(sortableRowAttribute);

    if (!itemKey) {
      continue;
    }

    const bounds = rowElement.getBoundingClientRect();
    const distance =
      pointerY < bounds.top
        ? bounds.top - pointerY
        : pointerY > bounds.bottom
          ? pointerY - bounds.bottom
          : 0;

    if (distance < closestDistance) {
      closestDistance = distance;
      closestRow = { itemKey, bounds };
    }

    if (distance === 0) {
      break;
    }
  }

  return closestRow;
};

const hasSameOrder = <TItem,>(
  currentItems: TItem[],
  nextItems: TItem[],
  getItemKey: (item: TItem) => string
) =>
  currentItems.length === nextItems.length &&
  currentItems.every((item, index) => getItemKey(item) === getItemKey(nextItems[index]));

/**
 * Vertical list whose rows can be dragged into a new order by their grip
 * handle. Dragging is built on pointer events so it works with mouse, touch,
 * and pen, and the handle also responds to the arrow keys so the list can be
 * reordered from a keyboard.
 */
export default function SortableList<TItem>({
  className,
  getItemKey,
  getItemLabel,
  items,
  onReorder,
  renderItem
}: SortableListProps<TItem>) {
  const [draggedItemKey, setDraggedItemKey] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<TItem[] | null>(null);

  // Latest-value refs keep the drag listeners stable for the whole gesture even
  // though the parent re-renders while the preview order changes.
  const itemsRef = useRef(items);
  const getItemKeyRef = useRef(getItemKey);
  const onReorderRef = useRef(onReorder);
  const previewItemsRef = useRef<TItem[] | null>(null);
  const pointerPositionRef = useRef(0);
  const listRef = useRef<HTMLUListElement>(null);

  itemsRef.current = items;
  getItemKeyRef.current = getItemKey;
  onReorderRef.current = onReorder;

  const visibleItems = previewItems ?? items;

  // Where the pointer sits decides where the dragged row lands, re-measured on
  // every move so the preview stays correct while the list reflows.
  const previewDropOnPointerPosition = useCallback((clientY: number) => {
    const currentItems = previewItemsRef.current;
    const hoveredRow = findRowClosestToPointer(listRef.current, clientY);

    if (!currentItems || !hoveredRow || hoveredRow.itemKey === draggedItemKey) {
      return;
    }

    const readItemKey = getItemKeyRef.current;
    const fromIndex = currentItems.findIndex((item) => readItemKey(item) === draggedItemKey);
    const toIndex = currentItems.findIndex((item) => readItemKey(item) === hoveredRow.itemKey);

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    // Only take over a slot once the pointer passes the middle of the hovered
    // row, so two rows do not flip back and forth around their shared edge.
    const hoveredRowMiddle = hoveredRow.bounds.top + hoveredRow.bounds.height / 2;

    if (toIndex > fromIndex ? clientY < hoveredRowMiddle : clientY > hoveredRowMiddle) {
      return;
    }

    const reorderedItems = moveItem(currentItems, fromIndex, toIndex);
    previewItemsRef.current = reorderedItems;
    // Rendered synchronously: the next pointer move measures the rows again and
    // has to see the layout this move produced, not the previous one.
    flushSync(() => {
      setPreviewItems(reorderedItems);
    });
  }, [draggedItemKey]);

  useEffect(() => {
    if (!draggedItemKey) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      pointerPositionRef.current = event.clientY;
      previewDropOnPointerPosition(event.clientY);
    };

    const finishDragging = (shouldCommitOrder: boolean) => {
      const reorderedItems = previewItemsRef.current;

      previewItemsRef.current = null;
      setPreviewItems(null);
      setDraggedItemKey(null);

      if (
        shouldCommitOrder &&
        reorderedItems &&
        !hasSameOrder(itemsRef.current, reorderedItems, getItemKeyRef.current)
      ) {
        onReorderRef.current(reorderedItems);
      }
    };

    const handlePointerUp = () => finishDragging(true);
    const handlePointerCancel = () => finishDragging(false);

    // Keeps long lists reachable: holding a row near a screen edge scrolls the
    // page and re-evaluates the drop target from the last pointer position. It
    // only scrolls while the list itself continues past that edge, so a list
    // that fits on screen never drags the page away from the user.
    const autoScrollTimer = window.setInterval(() => {
      const listBounds = listRef.current?.getBoundingClientRect();

      if (!listBounds) {
        return;
      }

      const pointerY = pointerPositionRef.current;
      const distanceFromBottom = window.innerHeight - pointerY;

      if (pointerY < autoScrollEdgeSize && listBounds.top < 0) {
        window.scrollBy(0, -autoScrollStep);
      } else if (
        distanceFromBottom < autoScrollEdgeSize &&
        listBounds.bottom > window.innerHeight
      ) {
        window.scrollBy(0, autoScrollStep);
      } else {
        return;
      }

      previewDropOnPointerPosition(pointerY);
    }, autoScrollIntervalMs);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.clearInterval(autoScrollTimer);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [draggedItemKey, previewDropOnPointerPosition]);

  const startDragging = (event: ReactPointerEvent<HTMLButtonElement>, itemKey: string) => {
    if (event.button !== 0) {
      return;
    }

    // Stops the browser from starting a text selection or a native image drag.
    event.preventDefault();
    pointerPositionRef.current = event.clientY;
    previewItemsRef.current = items;
    setPreviewItems(items);
    setDraggedItemKey(itemKey);
  };

  const moveItemWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>, itemKey: string) => {
    const offset = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;

    if (offset === 0) {
      return;
    }

    const fromIndex = items.findIndex((item) => getItemKey(item) === itemKey);
    const toIndex = fromIndex + offset;

    if (fromIndex === -1 || toIndex < 0 || toIndex >= items.length) {
      return;
    }

    event.preventDefault();
    onReorder(moveItem(items, fromIndex, toIndex));
  };

  return (
    <ul
      className={cn("space-y-2", draggedItemKey ? "select-none" : null, className)}
      ref={listRef}
    >
      {visibleItems.map((item) => {
        const itemKey = getItemKey(item);
        const isDragged = itemKey === draggedItemKey;

        return (
          <li
            className={cn(
              "flex items-stretch gap-1 rounded-2xl border bg-surface transition",
              isDragged ? "border-brand-border shadow-card ring-2 ring-brand/45" : "border-border"
            )}
            key={itemKey}
            {...{ [sortableRowAttribute]: itemKey }}
          >
            <button
              aria-label={`Reorder ${getItemLabel(item)}. Drag it, or move it with the arrow up and arrow down keys.`}
              className={cn(
                "flex w-9 shrink-0 touch-none items-center justify-center rounded-l-2xl text-fg-subtle transition",
                "hover:bg-surface-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-inset focus-visible:ring-brand/45",
                isDragged ? "cursor-grabbing text-brand" : "cursor-grab"
              )}
              onKeyDown={(event) => moveItemWithKeyboard(event, itemKey)}
              onPointerDown={(event) => startDragging(event, itemKey)}
              type="button"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">{renderItem(item)}</div>
          </li>
        );
      })}
    </ul>
  );
}
