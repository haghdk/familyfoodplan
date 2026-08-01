"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";

type RowKey = string | number;

type ReorderAnimationOptions = {
  /** How long a row takes to travel to its new slot. */
  durationMs?: number;
};

type ReorderAnimation<TContainer extends HTMLElement> = {
  /** Attach to the element that wraps the rows; it is the measuring frame. */
  containerRef: RefObject<TContainer | null>;
  /** Returns the `ref` callback for the row with this key. */
  registerRow: (rowKey: RowKey) => (element: HTMLElement | null) => void;
};

const defaultDurationMs = 260;

// Starts quickly and settles softly, so a row that travels the length of the
// list still reads as one movement rather than a jump.
const movementEasing = "cubic-bezier(0.22, 0.61, 0.36, 1)";

// Sub-pixel differences come from rounding, not from an actual move.
const smallestVisibleMoveInPixels = 0.5;

// Small grace period on top of the transition before the inline styles are
// cleaned off a row again.
const settleGraceMs = 60;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Animates the rows of a list from where they were to where a re-render just
 * put them (the "FLIP" technique): the browser lays the new order out, then
 * every row that moved is offset back to where it came from and released, so it
 * slides into its new slot. Reordering the array is all a caller has to do —
 * the rows glide instead of the list snapping into a new shape under the
 * reader's eyes.
 *
 * Rows are measured against the container rather than the viewport, so page
 * scrolling and anything rendered above the list never look like movement.
 *
 * The slide is a CSS transition on an inline transform rather than a Web
 * Animations API animation on purpose: reordering a keyed list makes React move
 * the row's DOM node, and a browser cancels an element's animations when it is
 * taken out of the document — even for a move that puts it straight back.
 * Inline styles survive that, so the row that was just ticked, the one row that
 * is always moved rather than pushed aside, animates like all the others.
 */
export const useReorderAnimation = <TContainer extends HTMLElement = HTMLUListElement>(
  orderedRowKeys: RowKey[],
  { durationMs = defaultDurationMs }: ReorderAnimationOptions = {}
): ReorderAnimation<TContainer> => {
  const containerRef = useRef<TContainer | null>(null);
  const rowElements = useRef(new Map<RowKey, HTMLElement>());
  const rowRefCallbacks = useRef(new Map<RowKey, (element: HTMLElement | null) => void>());
  const previousRowOffsets = useRef(new Map<RowKey, number>());
  const settleTimers = useRef(new Map<RowKey, number>());

  // Read inside the layout effect instead of being a dependency of it: the
  // effect only has to run when the order itself changed.
  const orderedRowKeysRef = useRef(orderedRowKeys);
  orderedRowKeysRef.current = orderedRowKeys;

  const orderSignature = orderedRowKeys.join("|");

  // The same callback identity is handed back for a given key on every render,
  // so React does not detach and re-attach rows that merely changed position.
  const registerRow = useCallback((rowKey: RowKey) => {
    const cachedCallback = rowRefCallbacks.current.get(rowKey);

    if (cachedCallback) {
      return cachedCallback;
    }

    const refCallback = (element: HTMLElement | null) => {
      if (element) {
        rowElements.current.set(rowKey, element);
        return;
      }

      rowElements.current.delete(rowKey);
      window.clearTimeout(settleTimers.current.get(rowKey));
      settleTimers.current.delete(rowKey);
    };

    rowRefCallbacks.current.set(rowKey, refCallback);

    return refCallback;
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const presentRowKeys = new Set<RowKey>(orderedRowKeysRef.current);

    for (const rowKey of rowRefCallbacks.current.keys()) {
      if (!presentRowKeys.has(rowKey)) {
        rowRefCallbacks.current.delete(rowKey);
        previousRowOffsets.current.delete(rowKey);
      }
    }

    const measureRowOffsets = () => {
      const containerTop = container.getBoundingClientRect().top;
      const rowOffsets = new Map<RowKey, number>();

      for (const [rowKey, element] of rowElements.current) {
        rowOffsets.set(rowKey, element.getBoundingClientRect().top - containerTop);
      }

      return rowOffsets;
    };

    // Where the rows are painted right now, which for a row caught mid-slide is
    // its new layout position plus whatever is left of that slide.
    const paintedRowOffsets = measureRowOffsets();

    for (const [rowKey, element] of rowElements.current) {
      window.clearTimeout(settleTimers.current.get(rowKey));
      settleTimers.current.delete(rowKey);
      element.style.transition = "none";
      element.style.transform = "";
    }

    // Measuring flushes the cleared transforms, so this pass is pure layout.
    const layoutRowOffsets = measureRowOffsets();
    const offsetsBeforeThisRender = previousRowOffsets.current;
    previousRowOffsets.current = layoutRowOffsets;

    if (prefersReducedMotion()) {
      return;
    }

    const movedRows: [RowKey, HTMLElement][] = [];

    for (const [rowKey, element] of rowElements.current) {
      const previousOffset = offsetsBeforeThisRender.get(rowKey);

      // A row that was not on the list before has nowhere to travel from.
      if (previousOffset === undefined) {
        continue;
      }

      const layoutOffset = layoutRowOffsets.get(rowKey) ?? 0;
      const unfinishedSlide = (paintedRowOffsets.get(rowKey) ?? layoutOffset) - layoutOffset;
      const distanceToTravel = previousOffset + unfinishedSlide - layoutOffset;

      if (Math.abs(distanceToTravel) < smallestVisibleMoveInPixels) {
        continue;
      }

      element.style.transform = `translateY(${distanceToTravel}px)`;
      movedRows.push([rowKey, element]);
    }

    if (movedRows.length === 0) {
      return;
    }

    // One forced reflow for the whole list, so the offsets set above count as
    // the starting point of the transitions started below.
    container.getBoundingClientRect();

    for (const [rowKey, element] of movedRows) {
      element.style.transition = `transform ${durationMs}ms ${movementEasing}`;
      element.style.transform = "";

      settleTimers.current.set(
        rowKey,
        window.setTimeout(() => {
          element.style.transition = "";
          settleTimers.current.delete(rowKey);
        }, durationMs + settleGraceMs)
      );
    }
  }, [durationMs, orderSignature]);

  useEffect(() => {
    const pendingSettleTimers = settleTimers.current;

    return () => {
      for (const timerId of pendingSettleTimers.values()) {
        window.clearTimeout(timerId);
      }

      pendingSettleTimers.clear();
    };
  }, []);

  return { containerRef, registerRow };
};
