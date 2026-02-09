import Link from "next/link";
import { cookies } from "next/headers";
import { adminSessionCookieName, backendApiUrl } from "../../lib/auth";

type PlanListItem = {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  daysCount: number;
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

const getPlans = async (): Promise<PlanListItem[]> => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(adminSessionCookieName)?.value;

  try {
    const response = await fetch(`${backendApiUrl}/api/plans`, {
      headers: {
        ...(sessionToken ? { Cookie: `${adminSessionCookieName}=${sessionToken}` } : {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { plans: PlanListItem[] };
    return data.plans;
  } catch (_error) {
    return [];
  }
};

export default async function PlansPage() {
  const plans = await getPlans();

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Plans</h1>
          <p className="mt-2 text-sm text-slate-600">
            Select a weekly plan to edit meals or open related grocery views.
          </p>
        </div>
        <Link
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          href="/plan/new"
        >
          Create new plan
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No plans found yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-slate-900">{plan.name}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {formatDateRange(plan.startDate, plan.endDate)}
              </p>
              <p className="mt-2 text-sm text-slate-600">{plan.daysCount} day(s)</p>

              <div className="mt-4 flex gap-3">
                <Link
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  href={`/plan/${plan.id}`}
                >
                  Open plan
                </Link>
                <Link
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                  href={`/plan/${plan.id}/grocery-list`}
                >
                  Grocery list
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
