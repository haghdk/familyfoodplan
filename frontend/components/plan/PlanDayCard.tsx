"use client";

import { useEffect, useMemo, useState } from "react";
import { backendApiUrl } from "../../lib/auth";

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

type PlanDayCardProps = {
  planId: number;
  dayLabel: string;
  dayKey: string;
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

export default function PlanDayCard({
  planId,
  dayLabel,
  dayKey,
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

  const saveMealRow = async (
    row: MealRow,
    mealType: "breakfast" | "lunch"
  ) => {
    const normalizedName = row.name.trim();

    if (!normalizedName) {
      const message = `${mealType === "breakfast" ? "Breakfast" : "Lunch"} name is required.`;
      if (mealType === "breakfast") {
        setBreakfastRows((currentRows) => updateMealRow(currentRows, row.localId, { errorMessage: message }));
      } else {
        setLunchRows((currentRows) => updateMealRow(currentRows, row.localId, { errorMessage: message }));
      }
      return;
    }

    if (mealType === "breakfast") {
      setBreakfastRows((currentRows) => updateMealRow(currentRows, row.localId, { isSaving: true }));
    } else {
      setLunchRows((currentRows) => updateMealRow(currentRows, row.localId, { isSaving: true }));
    }

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

      const setter = mealType === "breakfast" ? setBreakfastRows : setLunchRows;
      setter((currentRows) =>
        currentRows.map((currentRow) =>
          currentRow.localId === row.localId ? createLocalMealRow(savedMeal) : currentRow
        )
      );
      setFeedback({ type: "success", message: `${mealType === "breakfast" ? "Breakfast" : "Lunch"} saved.` });
    } catch (_error) {
      const setter = mealType === "breakfast" ? setBreakfastRows : setLunchRows;
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

    const setter = mealType === "breakfast" ? setBreakfastRows : setLunchRows;
    setter((currentRows) => updateMealRow(currentRows, row.localId, { isSaving: false }));
  };

  const deleteMealRow = async (row: MealRow, mealType: "breakfast" | "lunch") => {
    setFeedback(null);
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
      setFeedback({ type: "success", message: `${mealType === "breakfast" ? "Breakfast" : "Lunch"} deleted.` });
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

  return (
    <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header>
        <h3 className="text-lg font-semibold text-slate-900">{dayLabel}</h3>
        <p className="text-sm text-slate-500">{dayKey}</p>
      </header>

      {feedback ? (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      <section className="space-y-3 rounded-xl border border-slate-200 p-4">
        <h4 className="font-semibold text-slate-900">Dinner</h4>
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setDinnerName(event.target.value)} placeholder="Dinner dish" type="text" value={dinnerName} />
        <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setDinnerNotes(event.target.value)} placeholder="Notes (optional)" rows={2} value={dinnerNotes} />
        <button className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={isSavingDinner} onClick={saveDinner} type="button">
          {isSavingDinner ? "Saving..." : "Save dinner"}
        </button>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-slate-900">Breakfasts</h4>
          <button className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 hover:border-slate-400" onClick={() => setBreakfastRows((rows) => [...rows, createLocalMealRow()])} type="button">
            Add breakfast row
          </button>
        </div>

        {membersErrorMessage ? <p className="text-sm text-rose-700">{membersErrorMessage}</p> : null}
        {breakfastRows.length === 0 ? <p className="text-sm text-slate-500">No breakfasts added yet.</p> : null}

        {breakfastRows.map((row) => (
          <div key={row.localId} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setBreakfastRows((currentRows) => updateMealRow(currentRows, row.localId, { name: event.target.value }))} placeholder="Breakfast dish" type="text" value={row.name} />
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setBreakfastRows((currentRows) => updateMealRow(currentRows, row.localId, { familyMemberId: event.target.value ? Number(event.target.value) : null }))} value={row.familyMemberId ?? ""}>
              {memberOptions.map((member) => (
                <option key={member.id ?? "none"} value={member.id ?? ""}>{member.name}</option>
              ))}
            </select>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setBreakfastRows((currentRows) => updateMealRow(currentRows, row.localId, { notes: event.target.value }))} placeholder="Notes (optional)" type="text" value={row.notes} />
            {row.errorMessage ? <p className="text-sm text-rose-700">{row.errorMessage}</p> : null}
            <div className="flex gap-2">
              <button className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={row.isSaving} onClick={() => saveMealRow(row, "breakfast")} type="button">{row.isSaving ? "Saving..." : "Save"}</button>
              <button className="rounded-full border border-rose-200 px-4 py-1.5 text-sm font-semibold text-rose-700 hover:border-rose-300 disabled:opacity-60" disabled={row.isSaving} onClick={() => deleteMealRow(row, "breakfast")} type="button">Delete</button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-slate-900">Lunches</h4>
          <button className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 hover:border-slate-400" onClick={() => setLunchRows((rows) => [...rows, createLocalMealRow()])} type="button">
            Add lunch row
          </button>
        </div>

        {membersErrorMessage ? <p className="text-sm text-rose-700">{membersErrorMessage}</p> : null}
        {lunchRows.length === 0 ? <p className="text-sm text-slate-500">No lunches added yet.</p> : null}

        {lunchRows.map((row) => (
          <div key={row.localId} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setLunchRows((currentRows) => updateMealRow(currentRows, row.localId, { name: event.target.value }))} placeholder="Lunch dish" type="text" value={row.name} />
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setLunchRows((currentRows) => updateMealRow(currentRows, row.localId, { familyMemberId: event.target.value ? Number(event.target.value) : null }))} value={row.familyMemberId ?? ""}>
              {memberOptions.map((member) => (
                <option key={member.id ?? "none"} value={member.id ?? ""}>{member.name}</option>
              ))}
            </select>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setLunchRows((currentRows) => updateMealRow(currentRows, row.localId, { notes: event.target.value }))} placeholder="Notes (optional)" type="text" value={row.notes} />
            {row.errorMessage ? <p className="text-sm text-rose-700">{row.errorMessage}</p> : null}
            <div className="flex gap-2">
              <button className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={row.isSaving} onClick={() => saveMealRow(row, "lunch")} type="button">{row.isSaving ? "Saving..." : "Save"}</button>
              <button className="rounded-full border border-rose-200 px-4 py-1.5 text-sm font-semibold text-rose-700 hover:border-rose-300 disabled:opacity-60" disabled={row.isSaving} onClick={() => deleteMealRow(row, "lunch")} type="button">Delete</button>
            </div>
          </div>
        ))}
      </section>
    </article>
  );
}
