"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { cn } from "../../lib/cn";

export type SwappableMealType = "breakfast" | "lunch" | "dinner";

export const mealTypeLabels: Record<SwappableMealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner"
};

export type SwapDay = {
  dayKey: string;
  dayLabel: string;
  /** What each meal of this day currently holds, shown in the swap menu. */
  mealSummaries: Record<SwappableMealType, string>;
};

export type SwapPartner = SwapDay & { mealSummary: string };

type ActiveDrag = {
  mealType: SwappableMealType;
  dayKey: string;
  dayLabel: string;
};

type MealSwapContextValue = {
  activeDrag: ActiveDrag | null;
  dropTargetDayKey: string | null;
  /** Meal + day currently being written to the server, so both cards can wait. */
  pendingSwap: { mealType: SwappableMealType; dayKeys: string[] } | null;
  beginDrag: (drag: ActiveDrag, pointerX: number, pointerY: number) => void;
  getSwapPartners: (mealType: SwappableMealType, dayKey: string) => SwapPartner[];
  swapMeals: (
    mealType: SwappableMealType,
    sourceDayKey: string,
    targetDayKey: string
  ) => void;
};

const MealSwapContext = createContext<MealSwapContextValue | null>(null);

/** Returns `null` outside a provider, so day cards render without swap controls. */
export const useMealSwap = () => useContext(MealSwapContext);

/** Attribute a meal section marks itself with so a drag can find it. */
export const mealDropZoneAttribute = "data-meal-drop-zone";

export const mealDropZoneId = (mealType: SwappableMealType, dayKey: string) =>
  `${mealType}:${dayKey}`;

const autoScrollEdgeSize = 90;
const autoScrollStep = 16;
const autoScrollIntervalMs = 30;

type MealSwapProviderProps = {
  children: ReactNode;
  days: SwapDay[];
  onSwap: (
    mealType: SwappableMealType,
    sourceDayKey: string,
    targetDayKey: string
  ) => void;
  pendingSwap: { mealType: SwappableMealType; dayKeys: string[] } | null;
};

/**
 * Holds the state of a meal being dragged from one day onto another. The drag
 * runs on pointer events so mouse, touch, and pen all take the same path, and
 * the day under the pointer is resolved by hit-testing rather than by listening
 * on every drop zone, which keeps the day cards free of drag plumbing.
 */
export default function MealSwapProvider({
  children,
  days,
  onSwap,
  pendingSwap
}: MealSwapProviderProps) {
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [dropTargetDayKey, setDropTargetDayKey] = useState<string | null>(null);
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 });

  // Latest-value refs keep the window listeners stable for a whole gesture even
  // though the provider re-renders as the drop target changes.
  const dropTargetDayKeyRef = useRef<string | null>(null);
  const pointerPositionRef = useRef({ x: 0, y: 0 });
  const onSwapRef = useRef(onSwap);

  onSwapRef.current = onSwap;

  const findDropTargetDayKey = useCallback(
    (mealType: SwappableMealType, clientX: number, clientY: number) => {
      const elementUnderPointer = document.elementFromPoint(clientX, clientY);
      const dropZone = elementUnderPointer?.closest(`[${mealDropZoneAttribute}]`);
      const dropZoneValue = dropZone?.getAttribute(mealDropZoneAttribute);

      if (!dropZoneValue) {
        return null;
      }

      const [dropZoneMealType, dropZoneDayKey] = dropZoneValue.split(":");

      // Only the same meal of another day can take the drop: dinners trade with
      // dinners, so breakfast and lunch stay untouched by a dinner swap.
      return dropZoneMealType === mealType ? dropZoneDayKey : null;
    },
    []
  );

  useEffect(() => {
    if (!activeDrag) {
      return;
    }

    const trackPointer = (clientX: number, clientY: number) => {
      pointerPositionRef.current = { x: clientX, y: clientY };
      setPointerPosition({ x: clientX, y: clientY });

      const hoveredDayKey = findDropTargetDayKey(activeDrag.mealType, clientX, clientY);
      const nextDropTargetDayKey =
        hoveredDayKey && hoveredDayKey !== activeDrag.dayKey ? hoveredDayKey : null;

      if (nextDropTargetDayKey !== dropTargetDayKeyRef.current) {
        dropTargetDayKeyRef.current = nextDropTargetDayKey;
        setDropTargetDayKey(nextDropTargetDayKey);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      trackPointer(event.clientX, event.clientY);
    };

    const finishDragging = (shouldDrop: boolean) => {
      const targetDayKey = dropTargetDayKeyRef.current;

      dropTargetDayKeyRef.current = null;
      setDropTargetDayKey(null);
      setActiveDrag(null);

      if (shouldDrop && targetDayKey) {
        onSwapRef.current(activeDrag.mealType, activeDrag.dayKey, targetDayKey);
      }
    };

    const handlePointerUp = () => finishDragging(true);
    const handlePointerCancel = () => finishDragging(false);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        finishDragging(false);
      }
    };

    // Day cards are tall, so the day being aimed at is often off screen when the
    // drag starts. Holding the meal against the top or bottom edge scrolls the
    // page and re-reads what now sits under the pointer.
    const autoScrollTimer = window.setInterval(() => {
      const { x, y } = pointerPositionRef.current;
      const distanceFromBottom = window.innerHeight - y;

      if (y < autoScrollEdgeSize && window.scrollY > 0) {
        window.scrollBy(0, -autoScrollStep);
      } else if (distanceFromBottom < autoScrollEdgeSize) {
        window.scrollBy(0, autoScrollStep);
      } else {
        return;
      }

      trackPointer(x, y);
    }, autoScrollIntervalMs);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearInterval(autoScrollTimer);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDrag, findDropTargetDayKey]);

  const beginDrag = useCallback((drag: ActiveDrag, pointerX: number, pointerY: number) => {
    pointerPositionRef.current = { x: pointerX, y: pointerY };
    setPointerPosition({ x: pointerX, y: pointerY });
    dropTargetDayKeyRef.current = null;
    setDropTargetDayKey(null);
    setActiveDrag(drag);
  }, []);

  const getSwapPartners = useCallback(
    (mealType: SwappableMealType, dayKey: string) =>
      days
        .filter((day) => day.dayKey !== dayKey)
        .map((day) => ({ ...day, mealSummary: day.mealSummaries[mealType] })),
    [days]
  );

  const swapMeals = useCallback(
    (mealType: SwappableMealType, sourceDayKey: string, targetDayKey: string) => {
      onSwapRef.current(mealType, sourceDayKey, targetDayKey);
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      activeDrag,
      dropTargetDayKey,
      pendingSwap,
      beginDrag,
      getSwapPartners,
      swapMeals
    }),
    [activeDrag, beginDrag, dropTargetDayKey, getSwapPartners, pendingSwap, swapMeals]
  );

  return (
    <MealSwapContext.Provider value={contextValue}>
      <div className={cn(activeDrag ? "select-none" : null)}>{children}</div>
      {activeDrag ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none fixed z-50 -translate-y-1/2 translate-x-4 rounded-full",
            "border border-brand-border bg-surface px-3 py-1.5 text-xs font-semibold",
            "text-fg shadow-card"
          )}
          style={{ left: pointerPosition.x, top: pointerPosition.y }}
        >
          {mealTypeLabels[activeDrag.mealType]} · {activeDrag.dayLabel}
        </div>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {activeDrag
          ? `Moving ${mealTypeLabels[activeDrag.mealType].toLowerCase()} from ${activeDrag.dayLabel}.`
          : ""}
      </span>
    </MealSwapContext.Provider>
  );
}
