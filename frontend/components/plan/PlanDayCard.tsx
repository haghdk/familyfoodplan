"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Croissant, Plus, Sandwich, ShoppingBasket, Trash2, UtensilsCrossed } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import { cn } from "../../lib/cn";
import { useTranslations } from "../../lib/i18n/client";
import { localeHeader } from "../../lib/i18n/requestHeaders";
import Alert from "../ui/Alert";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { SelectField, TextAreaField, TextField } from "../ui/Field";
import MealSwapHandle from "./MealSwapHandle";
import {
  mealDropZoneAttribute,
  mealDropZoneId,
  mealTypeLabel,
  mealTypeLabelInSentence,
  useMealSwap,
  type SwappableMealType
} from "./MealSwapProvider";

type Member = {
  id: number;
  name: string;
  isActive: boolean;
};

type DinnerDish = {
  id: number;
  name: string;
  notes: string | null;
  dishId: number | null;
};

type BreakfastDish = {
  id: number;
  name: string;
  notes: string | null;
  familyMemberId: number | null;
  dishId: number | null;
};

type LunchDish = {
  id: number;
  name: string;
  notes: string | null;
  familyMemberId: number | null;
  dishId: number | null;
};

/** A dish saved under Dishes, with the ingredients it takes to make it. */
type SavedDish = {
  id: number;
  name: string;
  ingredients: Array<{ id: number; name: string }>;
};

type MealRow = {
  localId: string;
  id?: number;
  name: string;
  notes: string;
  familyMemberId: number | null;
  /** The saved dish this meal was picked from, or null when it was typed in. */
  dishId: number | null;
  isSaving: boolean;
  errorMessage: string;
};

type MealType = "breakfast" | "lunch";

type PlanDayCardProps = {
  planId: number;
  dayLabel: string;
  dayKey: string;
  isToday?: boolean;
  initialDinner?: DinnerDish | null;
  initialBreakfastes?: BreakfastDish[];
  initialLunches?: LunchDish[];
};

const createLocalMealRow = (meal?: BreakfastDish | LunchDish): MealRow => ({
  localId: `${meal?.id ?? "new"}-${crypto.randomUUID()}`,
  id: meal?.id,
  name: meal?.name ?? "",
  notes: meal?.notes ?? "",
  familyMemberId: meal?.familyMemberId ?? null,
  dishId: meal?.dishId ?? null,
  isSaving: false,
  errorMessage: ""
});

type MealSectionProps = {
  title: string;
  icon: ReactNode;
  iconClassName: string;
  addLabel: string;
  emptyText: string;
  children: ReactNode;
  dayKey: string;
  dayLabel: string;
  mealType: SwappableMealType;
  onAdd?: () => void;
};

/**
 * One meal of one day. It doubles as the drop zone for a meal dragged off
 * another day: the section marks itself with the meal and day it stands for, and
 * the drag looks that marker up under the pointer.
 */
function MealSection({
  title,
  icon,
  iconClassName,
  addLabel,
  emptyText,
  children,
  dayKey,
  dayLabel,
  mealType,
  onAdd
}: MealSectionProps) {
  const mealSwap = useMealSwap();
  const isDraggedMeal =
    mealSwap?.activeDrag?.mealType === mealType && mealSwap.activeDrag.dayKey === dayKey;
  const canTakeDrop = Boolean(mealSwap?.activeDrag) && mealSwap?.activeDrag?.mealType === mealType;
  const isDropTarget = canTakeDrop && mealSwap?.dropTargetDayKey === dayKey;

  return (
    <section
      className={cn(
        "space-y-3 rounded-2xl transition",
        canTakeDrop && !isDraggedMeal ? "outline-1 outline-dashed outline-brand-border" : null,
        isDropTarget ? "bg-brand-soft/60 outline-2 outline-solid outline-brand" : null,
        isDraggedMeal ? "opacity-60" : null,
        canTakeDrop ? "outline-offset-8" : null
      )}
      {...{ [mealDropZoneAttribute]: mealDropZoneId(mealType, dayKey) }}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-fg">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-xl",
              iconClassName
            )}
          >
            {icon}
          </span>
          {title}
        </h4>
        <div className="flex items-center gap-1">
          <MealSwapHandle dayKey={dayKey} dayLabel={dayLabel} mealType={mealType} />
          {onAdd ? (
            <Button onClick={onAdd} size="sm" variant="ghost">
              <Plus className="h-3.5 w-3.5" />
              {addLabel}
            </Button>
          ) : null}
        </div>
      </div>
      {children ?? (
        <p className="text-sm text-fg-subtle">{emptyText}</p>
      )}
    </section>
  );
}

export default function PlanDayCard({
  planId,
  dayLabel,
  dayKey,
  isToday = false,
  initialDinner,
  initialBreakfastes = [],
  initialLunches = []
}: PlanDayCardProps) {
  const translator = useTranslations();
  const { locale, plural, t } = translator;
  const [members, setMembers] = useState<Member[]>([]);
  const [membersErrorMessage, setMembersErrorMessage] = useState("");
  const [savedDishes, setSavedDishes] = useState<SavedDish[]>([]);
  const [dinnerId, setDinnerId] = useState<number | null>(initialDinner?.id ?? null);
  const [dinnerName, setDinnerName] = useState(initialDinner?.name ?? "");
  const [dinnerNotes, setDinnerNotes] = useState(initialDinner?.notes ?? "");
  const [dinnerDishId, setDinnerDishId] = useState<number | null>(initialDinner?.dishId ?? null);
  const [isSavingDinner, setIsSavingDinner] = useState(false);
  // Which meal is having its dish ingredients copied to the grocery list, so
  // only that button reads as busy while it happens.
  const [pendingIngredientsKey, setPendingIngredientsKey] = useState<string | null>(null);
  const [breakfastRows, setBreakfastRows] = useState<MealRow[]>(
    initialBreakfastes.map((breakfast) => createLocalMealRow(breakfast))
  );
  const [lunchRows, setLunchRows] = useState<MealRow[]>(
    initialLunches.map((lunch) => createLocalMealRow(lunch))
  );
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const response = await fetch(`${backendApiUrl}/api/members`, {
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error("Unable to fetch members.");
        }

        const data = (await response.json()) as { members: Member[] };
        setMembers(data.members.filter((member) => member.isActive));
      } catch (_error) {
        setMembersErrorMessage(t("planDay.membersLoadFailed"));
      }
    };

    void loadMembers();
  }, [t]);

  useEffect(() => {
    const loadSavedDishes = async () => {
      try {
        const response = await fetch(`${backendApiUrl}/api/dishes`, {
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error("Unable to fetch dishes.");
        }

        const data = (await response.json()) as { dishes: SavedDish[] };
        setSavedDishes(data.dishes);
      } catch (_error) {
        // The picker is an optional shortcut: a meal can always be typed in, so
        // a failed dish load hides the shortcut rather than blocking the day.
        setSavedDishes([]);
      }
    };

    void loadSavedDishes();
  }, []);

  const memberOptions = useMemo(
    () => [{ id: null, name: t("planDay.noMemberSelected") }, ...members],
    [members, t]
  );

  const savedDishesById = useMemo(
    () => new Map(savedDishes.map((savedDish) => [savedDish.id, savedDish])),
    [savedDishes]
  );

  const hasIngredientsToAdd = (dishId: number | null) =>
    Boolean(dishId && (savedDishesById.get(dishId)?.ingredients.length ?? 0) > 0);

  /**
   * Copies the ingredients of the saved dish this meal was picked from onto the
   * plan's grocery list. Ingredients the meal already carries are left alone, so
   * pressing it again after editing the dish tops the list up instead of
   * duplicating it.
   */
  const addDishIngredients = async (
    pendingKey: string,
    mealLink: {
      dinnerDishId?: number;
      breakfastDishId?: number;
      lunchDishId?: number;
    }
  ) => {
    setPendingIngredientsKey(pendingKey);
    setFeedback(null);

    try {
      const response = await fetch(
        `${backendApiUrl}/api/plans/${planId}/grocery-items/from-dish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...localeHeader(locale) },
          credentials: "include",
          body: JSON.stringify(mealLink)
        }
      );

      if (!response.ok) {
        throw new Error("Unable to add dish ingredients.");
      }

      const data = (await response.json()) as { addedCount: number; skippedCount: number };

      const addedMessage = [
        plural("planDay.ingredientsAdded", data.addedCount),
        ...(data.skippedCount > 0 ? [t("planDay.ingredientsSkippedNote")] : [])
      ].join(" ");

      setFeedback({
        type: "success",
        message: data.addedCount > 0 ? addedMessage : t("planDay.ingredientsAlreadyAdded")
      });
    } catch (_error) {
      setFeedback({ type: "error", message: t("planDay.ingredientsAddFailed") });
    } finally {
      setPendingIngredientsKey(null);
    }
  };

  const renderDishPicker = ({
    selectedDishId,
    onSelect,
    fieldClassName
  }: {
    selectedDishId: number | null;
    onSelect: (savedDish: SavedDish | null) => void;
    fieldClassName?: string;
  }) => {
    if (savedDishes.length === 0) {
      return null;
    }

    return (
      <SelectField
        aria-label={t("planDay.chooseSavedDish")}
        fieldClassName={fieldClassName}
        onChange={(event) =>
          onSelect(
            event.target.value ? savedDishesById.get(Number(event.target.value)) ?? null : null
          )
        }
        value={selectedDishId ?? ""}
      >
        <option value="">{t("planDay.typeItYourself")}</option>
        {savedDishes.map((savedDish) => (
          <option key={savedDish.id} value={savedDish.id}>
            {savedDish.name}
          </option>
        ))}
      </SelectField>
    );
  };

  const saveDinner = async () => {
    const normalizedName = dinnerName.trim();

    if (!normalizedName) {
      setFeedback({ type: "error", message: t("planDay.dinnerNameRequired") });
      return;
    }

    setIsSavingDinner(true);
    setFeedback(null);

    try {
      const response = await fetch(`${backendApiUrl}/api/plans/${planId}/days/${dayKey}/dinner`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify({
          name: normalizedName,
          notes: dinnerNotes.trim() || null,
          dishId: dinnerDishId
        })
      });

      if (!response.ok) {
        throw new Error("Unable to save dinner.");
      }

      const data = (await response.json()) as { dinnerDish: DinnerDish };
      setDinnerId(data.dinnerDish.id);
      setDinnerName(data.dinnerDish.name);
      setDinnerNotes(data.dinnerDish.notes ?? "");
      setDinnerDishId(data.dinnerDish.dishId);
      setFeedback({ type: "success", message: t("planDay.dinnerSaved") });
    } catch (_error) {
      setFeedback({ type: "error", message: t("planDay.dinnerSaveFailed") });
    } finally {
      setIsSavingDinner(false);
    }
  };

  const updateMealRow = (
    rows: MealRow[],
    localId: string,
    updates: Partial<MealRow>
  ) => rows.map((row) => (row.localId === localId ? { ...row, ...updates, errorMessage: "" } : row));

  const saveMealRow = async (row: MealRow, mealType: MealType) => {
    const normalizedName = row.name.trim();
    const mealLabel = mealTypeLabel(translator, mealType);
    const mealLabelInSentence = mealTypeLabelInSentence(translator, mealType);
    const setter = mealType === "breakfast" ? setBreakfastRows : setLunchRows;

    if (!normalizedName) {
      setter((currentRows) =>
        updateMealRow(currentRows, row.localId, {
          errorMessage: t("planDay.nameRequired", { meal: mealLabelInSentence })
        })
      );
      return;
    }

    setter((currentRows) => updateMealRow(currentRows, row.localId, { isSaving: true }));
    setFeedback(null);

    const mealPath = mealType === "breakfast" ? "breakfasts" : "lunches";
    const endpoint = row.id
      ? `${backendApiUrl}/api/plans/${planId}/days/${dayKey}/${mealPath}/${row.id}`
      : `${backendApiUrl}/api/plans/${planId}/days/${dayKey}/${mealPath}`;
    const method = row.id ? "PUT" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify({
          name: normalizedName,
          notes: row.notes.trim() || null,
          familyMemberId: row.familyMemberId,
          dishId: row.dishId
        })
      });

      if (!response.ok) {
        throw new Error(`Unable to save ${mealType}.`);
      }

      const data = (await response.json()) as {
        breakfastDish?: BreakfastDish;
        lunchDish?: LunchDish;
      };
      const savedMeal = mealType === "breakfast" ? data.breakfastDish : data.lunchDish;

      if (!savedMeal) {
        throw new Error(`Missing ${mealType} payload.`);
      }

      setter((currentRows) =>
        currentRows.map((currentRow) =>
          currentRow.localId === row.localId ? createLocalMealRow(savedMeal) : currentRow
        )
      );
      setFeedback({
        type: "success",
        message: t("planDay.mealSaved", { meal: mealLabel })
      });
    } catch (_error) {
      setter((currentRows) =>
        updateMealRow(currentRows, row.localId, {
          errorMessage: t("planDay.rowSaveFailed", { meal: mealLabelInSentence }),
          isSaving: false
        })
      );
      setFeedback({
        type: "error",
        message: t("planDay.someRowsFailed", { meal: mealLabelInSentence })
      });
      return;
    }

    setter((currentRows) => updateMealRow(currentRows, row.localId, { isSaving: false }));
  };

  const deleteMealRow = async (row: MealRow, mealType: MealType) => {
    setFeedback(null);
    const mealLabel = mealTypeLabel(translator, mealType);
    const mealLabelInSentence = mealTypeLabelInSentence(translator, mealType);
    const setter = mealType === "breakfast" ? setBreakfastRows : setLunchRows;

    if (!row.id) {
      setter((currentRows) => currentRows.filter((currentRow) => currentRow.localId !== row.localId));
      return;
    }

    setter((currentRows) => updateMealRow(currentRows, row.localId, { isSaving: true }));

    try {
      const response = await fetch(
        `${backendApiUrl}/api/plans/${planId}/days/${dayKey}/${mealType === "breakfast" ? "breakfasts" : "lunches"}/${row.id}`,
        {
          method: "DELETE",
          headers: localeHeader(locale),
          credentials: "include"
        }
      );

      if (!response.ok) {
        throw new Error(`Unable to delete ${mealType}.`);
      }

      setter((currentRows) => currentRows.filter((currentRow) => currentRow.localId !== row.localId));
      setFeedback({
        type: "success",
        message: t("planDay.mealDeleted", { meal: mealLabel })
      });
    } catch (_error) {
      setter((currentRows) =>
        updateMealRow(currentRows, row.localId, {
          isSaving: false,
          errorMessage: t("planDay.rowDeleteFailed", { meal: mealLabelInSentence })
        })
      );
      setFeedback({
        type: "error",
        message: t("planDay.deleteFailed", { meal: mealLabelInSentence })
      });
    }
  };

  const renderMealRows = (rows: MealRow[], mealType: MealType) => {
    if (rows.length === 0) {
      return null;
    }

    const setter = mealType === "breakfast" ? setBreakfastRows : setLunchRows;
    const placeholder =
      mealType === "breakfast" ? t("planDay.breakfastDish") : t("planDay.lunchDish");

    return (
      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            className="space-y-3 rounded-2xl border border-border bg-surface-muted/50 p-3"
            key={row.localId}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {renderDishPicker({
                fieldClassName: "sm:col-span-2",
                onSelect: (savedDish) =>
                  setter((currentRows) =>
                    updateMealRow(currentRows, row.localId, {
                      dishId: savedDish?.id ?? null,
                      ...(savedDish ? { name: savedDish.name } : {})
                    })
                  ),
                selectedDishId: row.dishId
              })}
              <TextField
                aria-label={placeholder}
                fieldClassName="sm:col-span-2"
                onChange={(event) =>
                  setter((currentRows) =>
                    // Editing the name by hand means this is no longer the saved
                    // dish it was picked from, so the link is dropped.
                    updateMealRow(currentRows, row.localId, {
                      name: event.target.value,
                      dishId: null
                    })
                  )
                }
                placeholder={placeholder}
                type="text"
                value={row.name}
              />
              <SelectField
                aria-label={t("planDay.assignToMember")}
                onChange={(event) =>
                  setter((currentRows) =>
                    updateMealRow(currentRows, row.localId, {
                      familyMemberId: event.target.value ? Number(event.target.value) : null
                    })
                  )
                }
                value={row.familyMemberId ?? ""}
              >
                {memberOptions.map((member) => (
                  <option key={member.id ?? "none"} value={member.id ?? ""}>
                    {member.name}
                  </option>
                ))}
              </SelectField>
              <TextField
                aria-label={t("planDay.notes")}
                onChange={(event) =>
                  setter((currentRows) =>
                    updateMealRow(currentRows, row.localId, { notes: event.target.value })
                  )
                }
                placeholder={t("planDay.notesPlaceholder")}
                type="text"
                value={row.notes}
              />
            </div>

            {row.errorMessage ? (
              <p className="text-xs font-medium text-danger">{row.errorMessage}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={row.isSaving}
                onClick={() => saveMealRow(row, mealType)}
                size="sm"
              >
                {row.isSaving ? t("common.saving") : t("common.save")}
              </Button>
              <Button
                aria-label={t("planDay.deleteAriaLabel", {
                  meal: mealTypeLabelInSentence(translator, mealType)
                })}
                disabled={row.isSaving}
                onClick={() => deleteMealRow(row, mealType)}
                size="sm"
                variant="danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("common.delete")}
              </Button>
              {row.id && hasIngredientsToAdd(row.dishId) ? (
                <Button
                  disabled={pendingIngredientsKey === `${mealType}-${row.id}`}
                  onClick={() =>
                    addDishIngredients(`${mealType}-${row.id}`, {
                      [mealType === "breakfast" ? "breakfastDishId" : "lunchDishId"]: row.id
                    })
                  }
                  size="sm"
                  variant="soft"
                >
                  <ShoppingBasket className="h-3.5 w-3.5" />
                  {pendingIngredientsKey === `${mealType}-${row.id}`
                    ? t("planDay.addingIngredients")
                    : t("planDay.addIngredientsToGroceryList")}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <article
      className={cn(
        "overflow-hidden rounded-3xl border bg-surface shadow-card",
        isToday ? "border-brand-border ring-1 ring-brand/20" : "border-border"
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-muted/60 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-fg">{dayLabel}</h3>
          <p className="text-xs text-fg-subtle">{dayKey}</p>
        </div>
        {isToday ? <Badge tone="brand">{t("common.today")}</Badge> : null}
      </header>

      <div className="space-y-6 p-5">
        {feedback ? (
          <Alert tone={feedback.type === "success" ? "success" : "error"}>
            {feedback.message}
          </Alert>
        ) : null}

        {membersErrorMessage ? (
          <Alert tone="warning">{membersErrorMessage}</Alert>
        ) : null}

        <MealSection
          addLabel={t("planDay.addRow")}
          dayKey={dayKey}
          dayLabel={dayLabel}
          emptyText={t("planDay.noBreakfasts")}
          icon={<Croissant className="h-4 w-4" />}
          iconClassName="bg-breakfast-soft text-breakfast"
          mealType="breakfast"
          onAdd={() => setBreakfastRows((rows) => [...rows, createLocalMealRow()])}
          title={t("meals.breakfast")}
        >
          {renderMealRows(breakfastRows, "breakfast")}
        </MealSection>

        <div className="h-px bg-border" />

        <MealSection
          addLabel={t("planDay.addRow")}
          dayKey={dayKey}
          dayLabel={dayLabel}
          emptyText={t("planDay.noLunches")}
          icon={<Sandwich className="h-4 w-4" />}
          iconClassName="bg-lunch-soft text-lunch"
          mealType="lunch"
          onAdd={() => setLunchRows((rows) => [...rows, createLocalMealRow()])}
          title={t("meals.lunch")}
        >
          {renderMealRows(lunchRows, "lunch")}
        </MealSection>

        <div className="h-px bg-border" />

        <MealSection
          addLabel=""
          dayKey={dayKey}
          dayLabel={dayLabel}
          emptyText=""
          icon={<UtensilsCrossed className="h-4 w-4" />}
          iconClassName="bg-dinner-soft text-dinner"
          mealType="dinner"
          title={t("meals.dinner")}
        >
          <div className="space-y-3">
            {renderDishPicker({
              onSelect: (savedDish) => {
                setDinnerDishId(savedDish?.id ?? null);

                if (savedDish) {
                  setDinnerName(savedDish.name);
                }
              },
              selectedDishId: dinnerDishId
            })}
            <TextField
              aria-label={t("planDay.dinnerDish")}
              onChange={(event) => {
                setDinnerName(event.target.value);
                // Typing over the name means this is no longer the saved dish it
                // was picked from, so the link is dropped.
                setDinnerDishId(null);
              }}
              placeholder={t("planDay.dinnerDish")}
              type="text"
              value={dinnerName}
            />
            <TextAreaField
              aria-label={t("planDay.dinnerNotes")}
              onChange={(event) => setDinnerNotes(event.target.value)}
              placeholder={t("planDay.notesPlaceholder")}
              rows={2}
              value={dinnerNotes}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={isSavingDinner} onClick={saveDinner} size="sm">
                {isSavingDinner ? t("common.saving") : t("planDay.saveDinner")}
              </Button>
              {dinnerId && hasIngredientsToAdd(dinnerDishId) ? (
                <Button
                  disabled={pendingIngredientsKey === "dinner"}
                  onClick={() => addDishIngredients("dinner", { dinnerDishId: dinnerId })}
                  size="sm"
                  variant="soft"
                >
                  <ShoppingBasket className="h-3.5 w-3.5" />
                  {pendingIngredientsKey === "dinner"
                    ? t("planDay.addingIngredients")
                    : t("planDay.addIngredientsToGroceryList")}
                </Button>
              ) : null}
            </div>
          </div>
        </MealSection>
      </div>
    </article>
  );
}
