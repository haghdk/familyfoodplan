"use client";

import { useMemo, useState } from "react";
import { backendApiUrl } from "../../lib/auth";
import { createDateFormatter } from "../../lib/dates";
import { useTranslations } from "../../lib/i18n/client";
import { localeHeader } from "../../lib/i18n/requestHeaders";
import Alert from "../ui/Alert";
import PlanDayCard from "./PlanDayCard";
import MealSwapProvider, {
  mealTypeLabelInSentence,
  type SwapDay,
  type SwappableMealType
} from "./MealSwapProvider";

type MealDish = {
  id: number;
  name: string;
  notes: string | null;
  familyMemberId: number | null;
  dishId: number | null;
};

export type PlanDayMeals = {
  id: number;
  dayKey: string;
  dinnerDish: {
    id: number;
    name: string;
    notes: string | null;
    dishId: number | null;
  } | null;
  breakfastDishes: MealDish[];
  lunchDishes: MealDish[];
};

type SwapResponse = {
  planDays: Array<{
    id: number;
    date: string;
    dinnerDish: PlanDayMeals["dinnerDish"];
    breakfastDishes: MealDish[];
    lunchDishes: MealDish[];
  }>;
};

type PlanDayBoardProps = {
  initialPlanDays: PlanDayMeals[];
  planId: number;
  todayDayKey: string;
};

const summarizeMeal = (planDay: PlanDayMeals, mealType: SwappableMealType) => {
  if (mealType === "dinner") {
    return planDay.dinnerDish?.name ?? "";
  }

  const dishes = mealType === "breakfast" ? planDay.breakfastDishes : planDay.lunchDishes;

  return dishes.map((dish) => dish.name).join(", ");
};

/**
 * The editable week: one card per day, plus the machinery for moving a single
 * meal from one day to another. The board owns the days rather than each card
 * doing so, because a swap changes two cards at once and both have to end up
 * showing what the server now holds.
 */
export default function PlanDayBoard({
  initialPlanDays,
  planId,
  todayDayKey
}: PlanDayBoardProps) {
  const translator = useTranslations();
  const { locale, t } = translator;
  const { formatDayLabel } = useMemo(
    () => createDateFormatter(translator),
    [translator]
  );
  const [planDays, setPlanDays] = useState(initialPlanDays);
  const [pendingSwap, setPendingSwap] = useState<{
    mealType: SwappableMealType;
    dayKeys: string[];
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  // A day card keeps its own draft state, so a swapped day is remounted with the
  // meals it just received instead of being left showing the old ones.
  const [cardVersions, setCardVersions] = useState<Record<string, number>>({});

  const swapDays = useMemo<SwapDay[]>(
    () =>
      planDays.map((planDay) => ({
        dayKey: planDay.dayKey,
        dayLabel: formatDayLabel(planDay.dayKey),
        mealSummaries: {
          breakfast: summarizeMeal(planDay, "breakfast"),
          lunch: summarizeMeal(planDay, "lunch"),
          dinner: summarizeMeal(planDay, "dinner")
        }
      })),
    [formatDayLabel, planDays]
  );

  const swapMeals = async (
    mealType: SwappableMealType,
    sourceDayKey: string,
    targetDayKey: string
  ) => {
    if (pendingSwap || sourceDayKey === targetDayKey) {
      return;
    }

    setPendingSwap({ mealType, dayKeys: [sourceDayKey, targetDayKey] });
    setFeedback(null);

    try {
      const response = await fetch(`${backendApiUrl}/api/plans/${planId}/meal-swaps`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify({ mealType, sourceDayKey, targetDayKey })
      });

      if (!response.ok) {
        throw new Error("Unable to swap meals.");
      }

      const data = (await response.json()) as SwapResponse;
      const swappedDaysByKey = new Map(
        data.planDays.map((planDay) => [
          planDay.date,
          {
            id: planDay.id,
            dayKey: planDay.date,
            dinnerDish: planDay.dinnerDish,
            breakfastDishes: planDay.breakfastDishes,
            lunchDishes: planDay.lunchDishes
          }
        ])
      );

      setPlanDays((currentPlanDays) =>
        currentPlanDays.map(
          (planDay) => swappedDaysByKey.get(planDay.dayKey) ?? planDay
        )
      );
      setCardVersions((currentVersions) => ({
        ...currentVersions,
        [sourceDayKey]: (currentVersions[sourceDayKey] ?? 0) + 1,
        [targetDayKey]: (currentVersions[targetDayKey] ?? 0) + 1
      }));
      setFeedback({
        tone: "success",
        message: t("mealSwap.swapped", {
          meal: mealTypeLabelInSentence(translator, mealType),
          source: formatDayLabel(sourceDayKey),
          target: formatDayLabel(targetDayKey)
        })
      });
    } catch (_error) {
      setFeedback({
        tone: "error",
        message: t("mealSwap.swapFailed", {
          meal: mealTypeLabelInSentence(translator, mealType)
        })
      });
    } finally {
      setPendingSwap(null);
    }
  };

  return (
    <MealSwapProvider
      days={swapDays}
      onSwap={(mealType, sourceDayKey, targetDayKey) => {
        void swapMeals(mealType, sourceDayKey, targetDayKey);
      }}
      pendingSwap={pendingSwap}
    >
      <div className="space-y-4">
        {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}

        <p className="text-sm text-fg-subtle">
          {t("mealSwap.hintBefore")}{" "}
          <span className="font-semibold text-fg-muted">{t("mealSwap.swap")}</span>
          {t("mealSwap.hintAfter")}
        </p>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          {planDays.map((planDay) => (
            <PlanDayCard
              dayKey={planDay.dayKey}
              dayLabel={formatDayLabel(planDay.dayKey)}
              initialBreakfastes={planDay.breakfastDishes}
              initialDinner={planDay.dinnerDish}
              initialLunches={planDay.lunchDishes}
              isToday={planDay.dayKey === todayDayKey}
              key={`${planDay.id}-${cardVersions[planDay.dayKey] ?? 0}`}
              planId={planId}
            />
          ))}
        </div>
      </div>
    </MealSwapProvider>
  );
}
