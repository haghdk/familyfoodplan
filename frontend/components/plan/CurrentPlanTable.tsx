type CurrentPlanTableDayRow = {
  id: number;
  date: string;
  breakfasts?: string[];
  lunches: string[];
  dinners: string[];
};

type CurrentPlanTableProps = {
  planName: string;
  dateRange: string;
  dayRows: CurrentPlanTableDayRow[];
};

export default function CurrentPlanTable({
  planName,
  dateRange,
  dayRows
}: CurrentPlanTableProps) {
  const showBreakfastRow = dayRows.some((row) => (row.breakfasts?.length ?? 0) > 0);

  const mealSections: Array<{
    key: "breakfasts" | "lunches" | "dinners";
    label: string;
    emptyText: string;
  }> = [
    ...(showBreakfastRow
      ? [{ key: "breakfasts" as const, label: "Breakfast", emptyText: "No breakfast set" }]
      : []),
    { key: "lunches" as const, label: "Lunch", emptyText: "No lunch set" },
    { key: "dinners" as const, label: "Dinner", emptyText: "No dinner set" }
  ];

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Plan overview
        </p>
        <p className="mt-1 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{planName}</span>
          <span className="mx-2 text-slate-400">•</span>
          {dateRange}
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="hidden min-w-full divide-y divide-slate-200 text-left text-sm md:table">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Meal</th>
              {dayRows.map((row) => (
                <th key={row.id} className="px-4 py-3 font-semibold">
                  {row.date}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-slate-600">
            {dayRows.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-slate-500" colSpan={1}>
                  Could not load meals for the selected plan.
                </td>
              </tr>
            ) : mealSections.map((section) => (
              <tr key={section.key}>
                <td className="px-4 py-3 font-medium text-slate-900">{section.label}</td>
                {dayRows.map((row) => {
                  const dishes = row[section.key] ?? [];
                  return (
                    <td key={row.id} className="px-4 py-3 align-top">
                      {dishes.length > 0 ? dishes.join(", ") : section.emptyText}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-3 p-3 md:hidden">
          {dayRows.length === 0 ? (
            <p className="rounded-xl bg-white p-3 text-sm text-slate-500 ring-1 ring-slate-200">
              Could not load meals for the selected plan.
            </p>
          ) : dayRows.map((row) => (
            <article
              key={row.id}
              className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
            >
              <p className="text-sm font-semibold text-slate-900">{row.date}</p>
              <dl className="mt-3 space-y-2 text-sm text-slate-700">
                {showBreakfastRow ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Breakfast
                    </dt>
                    <dd className="mt-0.5">
                      {(row.breakfasts?.length ?? 0) > 0
                        ? row.breakfasts?.join(", ")
                        : "No breakfast set"}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Lunch
                  </dt>
                  <dd className="mt-0.5">
                    {row.lunches.length > 0 ? row.lunches.join(", ") : "No lunch set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Dinner
                  </dt>
                  <dd className="mt-0.5">
                    {row.dinners.length > 0 ? row.dinners.join(", ") : "No dinner set"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
