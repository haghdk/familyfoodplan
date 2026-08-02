import { Croissant, Sandwich, UtensilsCrossed } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { AppTranslator } from "../../lib/i18n/dictionaries";
import { getTranslations } from "../../lib/i18n/server";

export type CurrentPlanTableDayRow = {
  id: number;
  dayKey: string;
  weekdayLabel: string;
  dateLabel: string;
  isToday?: boolean;
  breakfasts?: string[];
  lunches: string[];
  dinners: string[];
};

type CurrentPlanTableProps = {
  dayRows: CurrentPlanTableDayRow[];
};

type MealSection = {
  key: "breakfasts" | "lunches" | "dinners";
  label: string;
  emptyText: string;
  icon: ReactNode;
  accentClassName: string;
  iconClassName: string;
};

const buildMealSections = (
  includeBreakfast: boolean,
  { t }: AppTranslator
): MealSection[] => [
  ...(includeBreakfast
    ? [
        {
          key: "breakfasts" as const,
          label: t("meals.breakfast"),
          emptyText: t("meals.notPlanned"),
          icon: <Croissant className="h-4 w-4" />,
          accentClassName: "text-breakfast",
          iconClassName: "bg-breakfast-soft text-breakfast"
        }
      ]
    : []),
  {
    key: "lunches" as const,
    label: t("meals.lunch"),
    emptyText: t("meals.notPlanned"),
    icon: <Sandwich className="h-4 w-4" />,
    accentClassName: "text-lunch",
    iconClassName: "bg-lunch-soft text-lunch"
  },
  {
    key: "dinners" as const,
    label: t("meals.dinner"),
    emptyText: t("meals.notPlanned"),
    icon: <UtensilsCrossed className="h-4 w-4" />,
    accentClassName: "text-dinner",
    iconClassName: "bg-dinner-soft text-dinner"
  }
];

export default async function CurrentPlanTable({ dayRows }: CurrentPlanTableProps) {
  const translator = await getTranslations();
  const { t } = translator;
  const includeBreakfast = dayRows.some((row) => (row.breakfasts?.length ?? 0) > 0);
  const mealSections = buildMealSections(includeBreakfast, translator);

  if (dayRows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/60 px-4 py-6 text-center text-sm text-fg-muted">
        {t("currentPlanTable.loadFailed")}
      </p>
    );
  }

  // A normal week fits the viewport, so share the width evenly and let dish
  // names wrap. Longer plans fall back to auto layout plus horizontal scroll.
  const useFixedLayout = dayRows.length <= 7;

  return (
    <div className="space-y-4">
      {/* Desktop: meal-by-day matrix */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
        <table
          className={cn(
            "w-full border-collapse text-left text-sm",
            useFixedLayout ? "table-fixed" : "min-w-full"
          )}
        >
          <thead>
            <tr className="bg-surface-muted">
              <th
                className={cn(
                  "sticky left-0 z-10 bg-surface-muted px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle",
                  useFixedLayout ? "w-36" : "min-w-36"
                )}
                scope="col"
              >
                {t("currentPlanTable.mealColumn")}
              </th>
              {dayRows.map((row) => (
                <th
                  className={cn(
                    "border-l border-border px-3 py-3 align-bottom",
                    !useFixedLayout && "min-w-32",
                    row.isToday && "bg-brand-soft"
                  )}
                  key={row.id}
                  scope="col"
                >
                  <span
                    className={cn(
                      "block text-sm font-semibold",
                      row.isToday ? "text-brand" : "text-fg"
                    )}
                  >
                    {row.weekdayLabel}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-fg-subtle">
                    {row.isToday ? t("common.today") : row.dateLabel}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mealSections.map((section) => (
              <tr className="border-t border-border bg-surface" key={section.key}>
                <th
                  className="sticky left-0 z-10 bg-surface px-3 py-3.5 text-left align-top"
                  scope="row"
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 text-sm font-semibold",
                      section.accentClassName
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-xl",
                        section.iconClassName
                      )}
                    >
                      {section.icon}
                    </span>
                    {section.label}
                  </span>
                </th>
                {dayRows.map((row) => {
                  const dishes = row[section.key] ?? [];

                  return (
                    <td
                      className={cn(
                        "border-l border-border px-3 py-3.5 align-top",
                        row.isToday && "bg-brand-soft/40"
                      )}
                      key={row.id}
                    >
                      {dishes.length > 0 ? (
                        <ul className="space-y-1">
                          {dishes.map((dish, dishIndex) => (
                            <li
                              className="text-sm text-fg"
                              key={`${row.id}-${section.key}-${dishIndex}`}
                            >
                              {dish}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-sm text-fg-subtle">
                          {section.emptyText}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked day cards */}
      <div className="space-y-3 md:hidden">
        {dayRows.map((row) => (
          <article
            className={cn(
              "rounded-2xl border bg-surface p-4",
              row.isToday ? "border-brand-border ring-1 ring-brand/25" : "border-border"
            )}
            key={row.id}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-fg">{row.weekdayLabel}</p>
              <p
                className={cn(
                  "text-xs font-medium",
                  row.isToday ? "text-brand" : "text-fg-subtle"
                )}
              >
                {row.isToday ? t("common.today") : row.dateLabel}
              </p>
            </div>

            <dl className="mt-3 space-y-2.5">
              {mealSections.map((section) => {
                const dishes = row[section.key] ?? [];

                return (
                  <div className="flex items-start gap-3" key={section.key}>
                    <dt
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl",
                        section.iconClassName
                      )}
                      title={section.label}
                    >
                      {section.icon}
                      <span className="sr-only">{section.label}</span>
                    </dt>
                    <dd className="min-w-0 flex-1 text-sm">
                      <span
                        className={cn(
                          "block text-xs font-semibold uppercase tracking-[0.1em]",
                          section.accentClassName
                        )}
                      >
                        {section.label}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block",
                          dishes.length > 0 ? "text-fg" : "text-fg-subtle"
                        )}
                      >
                        {dishes.length > 0 ? dishes.join(", ") : section.emptyText}
                      </span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
