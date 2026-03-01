import Link from "next/link";
import { cookies } from "next/headers";
import { adminSessionCookieName, backendApiUrl, userRoleCookieName } from "../../../lib/auth";
import PlanDayCard from "../../../components/plan/PlanDayCard";
import PlanSettingsForm from "../../../components/plan/PlanSettingsForm";
import SetCurrentPlanButton from "../../../components/plan/SetCurrentPlanButton";

type PlanDetailResponse = {
  plan: {
    id: number;
    name: string;
    isCurrent: boolean;
    startDate: string | null;
    endDate: string | null;
    planDays: Array<{
      id: number;
      date: string;
      dinnerDish: {
        id: number;
        name: string;
        notes: string | null;
      } | null;
      breakfastDishes: Array<{
        id: number;
        name: string;
        notes: string | null;
        familyMemberId: number | null;
      }>;
      lunchDishes: Array<{
        id: number;
        name: string;
        notes: string | null;
        familyMemberId: number | null;
      }>;
    }>;
  };
};

const formatDateRange = (startDate: string | null, endDate: string | null) => {
  if (startDate && endDate) {
    return `${startDate} → ${endDate}`;
  }

  return startDate ?? endDate ?? "Dates not set";
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

const getPlan = async (planId: string): Promise<PlanDetailResponse["plan"] | null> => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(adminSessionCookieName)?.value;

  try {
    const response = await fetch(`${backendApiUrl}/api/plans/${planId}`, {
      headers: {
        ...(sessionToken ? { Cookie: `${adminSessionCookieName}=${sessionToken}` } : {})
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

export default async function PlanPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plan = await getPlan(id);
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get(userRoleCookieName)?.value === "ADMIN";

  if (!plan) {
    return (
      <section className="space-y-4">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Could not load this plan.
        </p>
        <Link className="text-sm font-semibold text-emerald-700 hover:text-emerald-800" href="/plan">
          ← Back to plans
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{plan.name}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {formatDateRange(plan.startDate, plan.endDate)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          {isAdmin ? (
            <SetCurrentPlanButton
              idleLabel="Set as current plan"
              isCurrent={plan.isCurrent}
              planId={plan.id}
            />
          ) : null}
          <Link
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
            href={`/plan/${plan.id}/grocery-list`}
          >
            Open grocery list
          </Link>
        </div>
      </div>

      {isAdmin ? (
        <>
          <PlanSettingsForm
            planId={plan.id}
            initialName={plan.name}
            initialStartDate={plan.startDate}
            initialEndDate={plan.endDate}
          />

          <div className="grid gap-4 md:grid-cols-2">
            {plan.planDays.map((planDay) => (
              <PlanDayCard
                planId={plan.id}
                dayKey={planDay.date}
                dayLabel={formatDayLabel(planDay.date)}
                initialDinner={planDay.dinnerDish}
                initialBreakfastes={planDay.breakfastDishes}
                initialLunches={planDay.lunchDishes}
                key={planDay.id}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {plan.planDays.map((planDay) => (
            <article
              key={planDay.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-slate-900">{formatDayLabel(planDay.date)}</h2>
              <p className="mt-2 text-sm text-slate-700">
                Dinner: {planDay.dinnerDish?.name ?? "Not set"}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Breakfast: {planDay.breakfastDishes.map((dish) => dish.name).join(", ") || "None"}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Lunch: {planDay.lunchDishes.map((dish) => dish.name).join(", ") || "None"}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
