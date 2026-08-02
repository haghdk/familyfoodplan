import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowLeft,
  CalendarRange,
  Croissant,
  Sandwich,
  ShoppingCart,
  UtensilsCrossed
} from "lucide-react";
import { adminSessionCookieName, backendApiUrl, userRoleCookieName } from "../../../lib/auth";
import { createDateFormatter, getTodayDayKey, toDayKey } from "../../../lib/dates";
import { getTranslations } from "../../../lib/i18n/server";
import PlanDayBoard from "../../../components/plan/PlanDayBoard";
import PlanSettingsForm from "../../../components/plan/PlanSettingsForm";
import SetCurrentPlanButton from "../../../components/plan/SetCurrentPlanButton";
import Alert from "../../../components/ui/Alert";
import Badge from "../../../components/ui/Badge";
import { buttonClassName } from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import PageHeader from "../../../components/ui/PageHeader";

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
  const translator = await getTranslations();
  const { t, plural } = translator;
  const dateFormatter = createDateFormatter(translator);

  if (!plan) {
    return (
      <section className="mx-auto max-w-lg space-y-4">
        <Alert tone="error">{t("planDetail.loadFailed")}</Alert>
        <Link className={buttonClassName({ variant: "secondary" })} href="/plan">
          <ArrowLeft className="h-4 w-4" />
          {t("planDetail.backToPlans")}
        </Link>
      </section>
    );
  }

  const todayDayKey = getTodayDayKey();

  return (
    <section className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition hover:text-brand"
          href="/plan"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("planDetail.allPlans")}
        </Link>
      </div>

      <PageHeader
        actions={
          <>
            {isAdmin ? (
              <SetCurrentPlanButton isCurrent={plan.isCurrent} planId={plan.id} />
            ) : null}
            <Link
              className={buttonClassName()}
              href={`/plan/${plan.id}/grocery-list`}
            >
              <ShoppingCart className="h-4 w-4" />
              {t("common.groceryList")}
            </Link>
          </>
        }
        description={plural("planDetail.daysInPlan", plan.planDays.length)}
        title={plan.name}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge icon={<CalendarRange className="h-3.5 w-3.5" />} tone="brand">
          {dateFormatter.formatDateRange(plan.startDate, plan.endDate)}
        </Badge>
        {plan.isCurrent ? (
          <Badge tone="accent">{t("common.currentPlan")}</Badge>
        ) : null}
      </div>

      {isAdmin ? (
        <>
          <PlanSettingsForm
            initialEndDate={toDayKey(plan.endDate)}
            initialName={plan.name}
            initialStartDate={toDayKey(plan.startDate)}
            planId={plan.id}
          />

          <PlanDayBoard
            initialPlanDays={plan.planDays.map((planDay) => ({
              id: planDay.id,
              dayKey: toDayKey(planDay.date) ?? planDay.date,
              dinnerDish: planDay.dinnerDish,
              breakfastDishes: planDay.breakfastDishes,
              lunchDishes: planDay.lunchDishes
            }))}
            planId={plan.id}
            todayDayKey={todayDayKey}
          />
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {plan.planDays.map((planDay) => {
            const dayKey = toDayKey(planDay.date) ?? planDay.date;
            const isToday = dayKey === todayDayKey;
            const meals = [
              {
                label: t("meals.breakfast"),
                icon: <Croissant className="h-4 w-4" />,
                iconClassName: "bg-breakfast-soft text-breakfast",
                value: planDay.breakfastDishes.map((dish) => dish.name).join(", ")
              },
              {
                label: t("meals.lunch"),
                icon: <Sandwich className="h-4 w-4" />,
                iconClassName: "bg-lunch-soft text-lunch",
                value: planDay.lunchDishes.map((dish) => dish.name).join(", ")
              },
              {
                label: t("meals.dinner"),
                icon: <UtensilsCrossed className="h-4 w-4" />,
                iconClassName: "bg-dinner-soft text-dinner",
                value: planDay.dinnerDish?.name ?? ""
              }
            ];

            return (
              <Card
                className={isToday ? "border-brand-border ring-1 ring-brand/20" : undefined}
                key={planDay.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-fg">
                    {dateFormatter.formatDayLabel(dayKey)}
                  </h2>
                  {isToday ? <Badge tone="brand">{t("common.today")}</Badge> : null}
                </div>

                <dl className="mt-4 space-y-3">
                  {meals.map((meal) => (
                    <div className="flex items-start gap-3" key={meal.label}>
                      <dt
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${meal.iconClassName}`}
                      >
                        {meal.icon}
                        <span className="sr-only">{meal.label}</span>
                      </dt>
                      <dd className="min-w-0 flex-1 text-sm">
                        <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-fg-subtle">
                          {meal.label}
                        </span>
                        <span
                          className={`mt-0.5 block ${meal.value ? "text-fg" : "text-fg-subtle"}`}
                        >
                          {meal.value || t("meals.notPlanned")}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
