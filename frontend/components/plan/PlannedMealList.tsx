import { cn } from "../../lib/cn";

/**
 * One planned dish as the read-only plan views show it. Breakfast and lunch are
 * eaten per person, so they carry the family member they were planned for;
 * dinner is shared by the whole family and leaves `memberName` unset.
 */
export type PlannedMeal = {
  name: string;
  memberName?: string | null;
};

type PlannedMealListProps = {
  meals: PlannedMeal[];
  /**
   * Whether this meal is an individual one, in which case every dish is
   * labelled with the person it was planned for. Left off for dinner, where a
   * name would suggest the dish is not shared.
   */
  showMemberNames: boolean;
  /** Wording for an individual dish nobody has been assigned to yet. */
  unassignedLabel: string;
  emptyText: string;
  className?: string;
};

/**
 * The list of dishes shown in one meal slot of a plan, with the family member
 * each individual dish belongs to.
 */
export default function PlannedMealList({
  meals,
  showMemberNames,
  unassignedLabel,
  emptyText,
  className
}: PlannedMealListProps) {
  if (meals.length === 0) {
    return <span className={cn("block text-sm text-fg-subtle", className)}>{emptyText}</span>;
  }

  return (
    <ul className={cn("space-y-1.5", className)}>
      {meals.map((meal, mealIndex) => (
        <li key={`${meal.name}-${mealIndex}`}>
          {showMemberNames ? (
            <span
              className={cn(
                "block text-xs font-semibold",
                meal.memberName ? "text-fg-muted" : "italic text-fg-subtle"
              )}
            >
              {meal.memberName ?? unassignedLabel}
            </span>
          ) : null}
          <span className="block text-sm text-fg">{meal.name}</span>
        </li>
      ))}
    </ul>
  );
}
