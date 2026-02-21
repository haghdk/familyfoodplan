import Link from "next/link";
import { cookies } from "next/headers";
import { adminSessionCookieName, backendApiUrl } from "../lib/auth";

type PlanListItem = {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  daysCount: number;
};

type PlanDetailResponse = {
  plan: {
    id: number;
    planDays?: Array<{
      id: number;
      date: string;
      dinnerDish: {
        id: number;
        name: string;
      } | null;
      lunchDishes: Array<{
        id: number;
        name: string;
      }>;
    }>;
    days?: Array<{
      id: number;
      date: string;
      dinnerDish: {
        id: number;
        name: string;
      } | null;
      lunchDishes: Array<{
        id: number;
        name: string;
      }>;
    }>;
  };
};

type CurrentPlanTableRow = {
  id: number;
  dayLabel: string;
  lunchLabel: string;
  dinnerLabel: string;
};

const formatDateRange = (startDate: string | null, endDate: string | null) => {
  if (!startDate && !endDate) {
    return "Dates not set";
  }

  if (startDate && endDate) {
    return `${startDate} → ${endDate}`;
  }

  return startDate ?? endDate ?? "Dates not set";
};

const asDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const normalizeDate = (date: Date) => {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  return normalizedDate;
};

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "UTC"
});

const formatDayLabel = (dayKey: string) => {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  return dayLabelFormatter.format(date);
};

const findCurrentPlan = (plans: PlanListItem[], today: Date) => {
  const matchingCurrentPlan = plans.find((plan) => {
    const startDate = asDate(plan.startDate);
    const endDate = asDate(plan.endDate);

    if (!startDate || !endDate) {
      return false;
    }

    const normalizedStartDate = normalizeDate(startDate);
    const normalizedEndDate = normalizeDate(endDate);

    return normalizedStartDate <= today && today <= normalizedEndDate;
  });

  return matchingCurrentPlan ?? plans[0] ?? null;
};

const selectRecentPlans = (plans: PlanListItem[], today: Date) => {
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - 28);

  return plans
    .filter((plan) => {
      const startDate = asDate(plan.startDate);
      const endDate = asDate(plan.endDate);

      return (startDate && normalizeDate(startDate) >= cutoffDate)
        || (endDate && normalizeDate(endDate) >= cutoffDate);
    })
    .slice(0, 6);
};

const getSessionToken = async () => {
  const cookieStore = await cookies();
  return cookieStore.get(adminSessionCookieName)?.value;
};

const getPlans = async (): Promise<PlanListItem[] | null> => {
  const sessionToken = await getSessionToken();

  try {
    const response = await fetch(`${backendApiUrl}/api/plans`, {
      headers: {
        ...(sessionToken
          ? { Cookie: `${adminSessionCookieName}=${sessionToken}` }
          : {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { plans: PlanListItem[] };
    return data.plans;
  } catch (_error) {
    return null;
  }
};

const getPlanById = async (planId: number): Promise<PlanDetailResponse["plan"] | null> => {
  const sessionToken = await getSessionToken();

  try {
    const response = await fetch(`${backendApiUrl}/api/plans/${planId}`, {
      headers: {
        ...(sessionToken
          ? { Cookie: `${adminSessionCookieName}=${sessionToken}` }
          : {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as PlanDetailResponse;
    return data.plan;
  } catch (_error) {
    return null;
  }
};

const buildCurrentPlanTableRows = (
  planDays: Array<{
    id: number;
    date: string;
    dinnerDish: { id: number; name: string } | null;
    lunchDishes: Array<{ id: number; name: string }>
  }>
): CurrentPlanTableRow[] => {
  return [...planDays]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((planDay) => ({
      id: planDay.id,
      dayLabel: formatDayLabel(planDay.date),
      lunchLabel:
        planDay.lunchDishes.length > 0
          ? planDay.lunchDishes.map((lunchDish) => lunchDish.name).join(", ")
          : "No lunch set",
      dinnerLabel: planDay.dinnerDish?.name ?? "No dinner set"
    }));
};

export default async function HomePage() {
  const plans = await getPlans();

  if (!plans || plans.length === 0) {
    return (
      <section className="space-y-8">
        <div className="rounded-3xl bg-white p-10 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
            Weekly planning made simple
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-slate-900">
            Build your next family meal plan.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            We could not load plans right now, or you have not created one yet.
            Start by creating your first weekly plan.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              href="/plan/new"
            >
              Create a plan
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const today = normalizeDate(new Date());
  const currentPlan = findCurrentPlan(plans, today);
  const currentPlanDetails = currentPlan ? await getPlanById(currentPlan.id) : null;
  const currentPlanRows = currentPlanDetails
    ? buildCurrentPlanTableRows(currentPlanDetails.days ?? currentPlanDetails.planDays ?? [])
    : [];
  const recentPlans = selectRecentPlans(plans, today).filter(
    (plan) => plan.id !== currentPlan?.id
  );

  return (
    <section className="space-y-8">
      <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
              Current plan
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              {currentPlan?.name ?? "No active plan"}
            </h1>
          </div>
          <Link
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            href="/plan/new"
          >
            Create new plan
          </Link>
        </div>

        {currentPlan ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Day</th>
                  <th className="px-4 py-3 font-semibold">Lunch</th>
                  <th className="px-4 py-3 font-semibold">Dinner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-slate-600">
                {currentPlanRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-slate-500" colSpan={3}>
                      Could not load meals for the selected plan.
                    </td>
                  </tr>
                ) : currentPlanRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.dayLabel}</td>
                    <td className="px-4 py-3">{row.lunchLabel}</td>
                    <td className="px-4 py-3">{row.dinnerLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {currentPlan ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              href={`/plan/${currentPlan.id}`}
            >
              Open plan
            </Link>
            <Link
              className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400"
              href={`/plan/${currentPlan.id}/grocery-list`}
            >
              Grocery list
            </Link>
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Recent plans (last 4 weeks)
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Quickly reopen recent weekly plans and grocery lists.
            </p>
          </div>
          <Link
            className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
            href="/plan"
          >
            View all plans
          </Link>
        </div>

        {recentPlans.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            No additional plans found in the last 4 weeks.
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Date range</th>
                  <th className="px-4 py-3 font-semibold">Days</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-slate-600">
                {recentPlans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {plan.name}
                    </td>
                    <td className="px-4 py-3">
                      {formatDateRange(plan.startDate, plan.endDate)}
                    </td>
                    <td className="px-4 py-3">{plan.daysCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          href={`/plan/${plan.id}`}
                        >
                          Open plan
                        </Link>
                        <Link
                          className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400"
                          href={`/plan/${plan.id}/grocery-list`}
                        >
                          Grocery list
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
