"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeftRight } from "lucide-react";
import { cn } from "../../lib/cn";
import {
  mealTypeLabels,
  useMealSwap,
  type SwappableMealType
} from "./MealSwapProvider";

type MealSwapHandleProps = {
  dayKey: string;
  dayLabel: string;
  mealType: SwappableMealType;
};

// How far the pointer has to travel before the press counts as a drag rather
// than as a tap that opens the day picker.
const dragThresholdInPixels = 6;

/**
 * The control that moves one meal of a day somewhere else. It is a drag handle
 * first — press it and drag the meal onto the same meal of another day — and
 * pressing it without dragging opens a list of the plan's other days instead,
 * which is the faster path on a phone and the only path from a keyboard.
 */
export default function MealSwapHandle({
  dayKey,
  dayLabel,
  mealType
}: MealSwapHandleProps) {
  const mealSwap = useMealSwap();
  const [isDayPickerOpen, setIsDayPickerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasStartedDragRef = useRef(false);

  useEffect(() => {
    if (!isDayPickerOpen) {
      return;
    }

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsDayPickerOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDayPickerOpen(false);
      }
    };

    window.addEventListener("pointerdown", closeOnOutsidePress);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePress);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isDayPickerOpen]);

  if (!mealSwap) {
    return null;
  }

  const swapPartners = mealSwap.getSwapPartners(mealType, dayKey);
  const isDragged =
    mealSwap.activeDrag?.mealType === mealType && mealSwap.activeDrag.dayKey === dayKey;
  const isSwapping =
    mealSwap.pendingSwap?.mealType === mealType &&
    mealSwap.pendingSwap.dayKeys.includes(dayKey);
  const mealLabel = mealTypeLabels[mealType];

  if (swapPartners.length === 0) {
    return null;
  }

  const startTrackingPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || isSwapping) {
      return;
    }

    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    hasStartedDragRef.current = false;
    // Capturing keeps the moves coming even once the pointer leaves the button,
    // and they still bubble to the window listener that runs the drag.
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startDraggingOnceMoved = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const pointerStart = pointerStartRef.current;

    if (!pointerStart || hasStartedDragRef.current) {
      return;
    }

    const travelledDistance = Math.hypot(
      event.clientX - pointerStart.x,
      event.clientY - pointerStart.y
    );

    if (travelledDistance < dragThresholdInPixels) {
      return;
    }

    hasStartedDragRef.current = true;
    setIsDayPickerOpen(false);
    mealSwap.beginDrag({ mealType, dayKey, dayLabel }, event.clientX, event.clientY);
  };

  const stopTrackingPointer = () => {
    pointerStartRef.current = null;
  };

  const openDayPickerUnlessDragged = () => {
    // The click that ends a drag is not a request for the day picker.
    if (hasStartedDragRef.current) {
      hasStartedDragRef.current = false;
      return;
    }

    setIsDayPickerOpen((isOpen) => !isOpen);
  };

  const swapWithDay = (targetDayKey: string) => {
    setIsDayPickerOpen(false);
    mealSwap.swapMeals(mealType, dayKey, targetDayKey);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isDayPickerOpen}
        aria-haspopup="menu"
        aria-label={`Move ${mealLabel.toLowerCase()} for ${dayLabel} to another day. Drag it onto another day, or activate to pick a day.`}
        className={cn(
          "inline-flex touch-none items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
          "font-semibold transition focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-brand/45 disabled:opacity-55",
          isDragged
            ? "cursor-grabbing bg-brand-soft text-brand"
            : "cursor-grab text-fg-subtle hover:bg-surface-muted hover:text-fg"
        )}
        disabled={isSwapping}
        onClick={openDayPickerUnlessDragged}
        onPointerCancel={stopTrackingPointer}
        onPointerDown={startTrackingPointer}
        onPointerMove={startDraggingOnceMoved}
        onPointerUp={stopTrackingPointer}
        type="button"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
        {isSwapping ? "Swapping..." : "Swap"}
      </button>

      {isDayPickerOpen ? (
        <div
          aria-label={`Swap ${mealLabel.toLowerCase()} with another day`}
          className={cn(
            "absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-2xl border",
            "border-border bg-surface p-1 shadow-card"
          )}
          role="menu"
        >
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-fg-subtle">
            Swap {mealLabel.toLowerCase()} with
          </p>
          {swapPartners.map((swapPartner) => (
            <button
              className={cn(
                "block w-full rounded-xl px-3 py-2 text-left transition",
                "hover:bg-surface-muted focus-visible:outline-none focus-visible:bg-surface-muted"
              )}
              key={swapPartner.dayKey}
              onClick={() => swapWithDay(swapPartner.dayKey)}
              role="menuitem"
              type="button"
            >
              <span className="block text-sm font-medium text-fg">
                {swapPartner.dayLabel}
              </span>
              <span
                className={cn(
                  "mt-0.5 block truncate text-xs",
                  swapPartner.mealSummary ? "text-fg-muted" : "text-fg-subtle"
                )}
              >
                {swapPartner.mealSummary || "Nothing planned"}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
