"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Croissant, Plus, Sandwich, Trash2, UtensilsCrossed } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import { cn } from "../../lib/cn";
import Alert from "../ui/Alert";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { SelectField, TextAreaField, TextField } from "../ui/Field";

type Member = {
  id: number;
  name: string;
  isActive: boolean;
};

type DinnerDish = {
  id: number;
  name: string;
  notes: string | null;
};

type BreakfastDish = {
  id: number;
  name: string;
  notes: string | null;
  familyMemberId: number | null;
};

type LunchDish = {
  id: number;
  name: string;
  notes: string | null;
  familyMemberId: number | null;
};

type MealRow = {
  localId: string;
  id?: number;
  name: string;
  notes: string;
  familyMemberId: number | null;
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
  onAdd?: () => void;
};

function MealSection({
  title,
  icon,
  iconClassName,
  addLabel,
  emptyText,
  children,
  onAdd
}: MealSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
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
        {onAdd ? (
          <Button onClick={onAdd} size="sm" variant="ghost">
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </Button>
        ) : null}
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
  const [members, setMembers] = useState<Member[]>([]);
  const [membersErrorMessage, setMembersErrorMessage] = useState("");
  const [dinnerName, setDinnerName] = useState(initialDinner?.name ?? "");
  const [dinnerNotes, setDinnerNotes] = useState(initialDinner?.notes ?? "");
  const [isSavingDinner, setIsSavingDinner] = useState(false);
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
        setMembersErrorMessage("Could not load members for breakfast/lunch assignments.");
      }
    };

    void loadMembers();
  }, []);

  const memberOptions = useMemo(
    () => [{ id: null, name: "No member selected" }, ...members],
    [members]
  );

  const saveDinner = async () => {
    const normalizedName = dinnerName.trim();

    if (!normalizedName) {
      setFeedback({ type: "error", message: "Dinner name is required." });
      return;
    }

    setIsSavingDinner(true);
    setFeedback(null);

    try {
      const response = await fetch(`${backendApiUrl}/api/plans/${planId}/days/${dayKey}/dinner`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: normalizedName,
          notes: dinnerNotes.trim() || null
        })
      });

      if (!response.ok) {
        throw new Error("Unable to save dinner.");
      }

      const data = (await response.json()) as { dinnerDish: DinnerDish };
      setDinnerName(data.dinnerDish.name);
      setDinnerNotes(data.dinnerDish.notes ?? "");
      setFeedback({ type: "success", message: "Dinner saved." });
    } catch (_error) {
      setFeedback({ type: "error", message: "Could not save dinner right now." });
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
    const mealLabel = mealType === "breakfast" ? "Breakfast" : "Lunch";
    const setter = mealType === "breakfast" ? setBreakfastRows : setLunchRows;

    if (!normalizedName) {
      setter((currentRows) =>
        updateMealRow(currentRows, row.localId, {
          errorMessage: `${mealLabel} name is required.`
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
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: normalizedName,
          notes: row.notes.trim() || null,
          familyMemberId: row.familyMemberId
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
      setFeedback({ type: "success", message: `${mealLabel} saved.` });
    } catch (_error) {
      setter((currentRows) =>
        updateMealRow(currentRows, row.localId, {
          errorMessage: `Could not save this ${mealType} right now.`,
          isSaving: false
        })
      );
      setFeedback({
        type: "error",
        message: `One or more ${mealType} rows failed to save.`
      });
      return;
    }

    setter((currentRows) => updateMealRow(currentRows, row.localId, { isSaving: false }));
  };

  const deleteMealRow = async (row: MealRow, mealType: MealType) => {
    setFeedback(null);
    const mealLabel = mealType === "breakfast" ? "Breakfast" : "Lunch";
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
          credentials: "include"
        }
      );

      if (!response.ok) {
        throw new Error(`Unable to delete ${mealType}.`);
      }

      setter((currentRows) => currentRows.filter((currentRow) => currentRow.localId !== row.localId));
      setFeedback({ type: "success", message: `${mealLabel} deleted.` });
    } catch (_error) {
      setter((currentRows) =>
        updateMealRow(currentRows, row.localId, {
          isSaving: false,
          errorMessage: `Could not delete this ${mealType} right now.`
        })
      );
      setFeedback({ type: "error", message: `Could not delete ${mealType}.` });
    }
  };

  const renderMealRows = (rows: MealRow[], mealType: MealType) => {
    if (rows.length === 0) {
      return null;
    }

    const setter = mealType === "breakfast" ? setBreakfastRows : setLunchRows;
    const placeholder = mealType === "breakfast" ? "Breakfast dish" : "Lunch dish";

    return (
      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            className="space-y-3 rounded-2xl border border-border bg-surface-muted/50 p-3"
            key={row.localId}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <TextField
                aria-label={placeholder}
                fieldClassName="sm:col-span-2"
                onChange={(event) =>
                  setter((currentRows) =>
                    updateMealRow(currentRows, row.localId, { name: event.target.value })
                  )
                }
                placeholder={placeholder}
                type="text"
                value={row.name}
              />
              <SelectField
                aria-label="Assign to family member"
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
                aria-label="Notes"
                onChange={(event) =>
                  setter((currentRows) =>
                    updateMealRow(currentRows, row.localId, { notes: event.target.value })
                  )
                }
                placeholder="Notes (optional)"
                type="text"
                value={row.notes}
              />
            </div>

            {row.errorMessage ? (
              <p className="text-xs font-medium text-danger">{row.errorMessage}</p>
            ) : null}

            <div className="flex items-center gap-2">
              <Button
                disabled={row.isSaving}
                onClick={() => saveMealRow(row, mealType)}
                size="sm"
              >
                {row.isSaving ? "Saving..." : "Save"}
              </Button>
              <Button
                aria-label={`Delete ${mealType}`}
                disabled={row.isSaving}
                onClick={() => deleteMealRow(row, mealType)}
                size="sm"
                variant="danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
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
        {isToday ? <Badge tone="brand">Today</Badge> : null}
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
          addLabel="Add row"
          emptyText="No breakfasts added yet."
          icon={<Croissant className="h-4 w-4" />}
          iconClassName="bg-breakfast-soft text-breakfast"
          onAdd={() => setBreakfastRows((rows) => [...rows, createLocalMealRow()])}
          title="Breakfast"
        >
          {renderMealRows(breakfastRows, "breakfast")}
        </MealSection>

        <div className="h-px bg-border" />

        <MealSection
          addLabel="Add row"
          emptyText="No lunches added yet."
          icon={<Sandwich className="h-4 w-4" />}
          iconClassName="bg-lunch-soft text-lunch"
          onAdd={() => setLunchRows((rows) => [...rows, createLocalMealRow()])}
          title="Lunch"
        >
          {renderMealRows(lunchRows, "lunch")}
        </MealSection>

        <div className="h-px bg-border" />

        <MealSection
          addLabel=""
          emptyText=""
          icon={<UtensilsCrossed className="h-4 w-4" />}
          iconClassName="bg-dinner-soft text-dinner"
          title="Dinner"
        >
          <div className="space-y-3">
            <TextField
              aria-label="Dinner dish"
              onChange={(event) => setDinnerName(event.target.value)}
              placeholder="Dinner dish"
              type="text"
              value={dinnerName}
            />
            <TextAreaField
              aria-label="Dinner notes"
              onChange={(event) => setDinnerNotes(event.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              value={dinnerNotes}
            />
            <Button disabled={isSavingDinner} onClick={saveDinner} size="sm">
              {isSavingDinner ? "Saving..." : "Save dinner"}
            </Button>
          </div>
        </MealSection>
      </div>
    </article>
  );
}
