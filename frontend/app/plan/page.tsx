import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, CalendarDays, CalendarRange, PlusCircle, ShoppingCart } from "lucide-react";
import { adminSessionCookieName, backendApiUrl, userRoleCookieName } from "../../lib/auth";
import { createDateFormatter } from "../../lib/dates";
import { getTranslations } from "../../lib/i18n/server";
import SetCurrentPlanButton from "../../components/plan/SetCurrentPlanButton";
import Badge from "../../components/ui/Badge";
import { buttonClassName } from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";

type PlanListItem = {
  id: number;
  name: string;
  isCurrent: boolean;
  startDate: string | null;
  endDate: string | null;
  daysCount: number;
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
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get(userRoleCookieName)?.value === "ADMIN";
  const translator = await getTranslations();
  const { t, plural } = translator;
  const dateFormatter = createDateFormatter(translator);

  return (
    <section className="space-y-6">
      <PageHeader
        actions={
          isAdmin ? (
            <Link className={buttonClassName()} href="/plan/new">
              <PlusCircle className="h-4 w-4" />
              {t("plans.createNewPlan")}
            </Link>
          ) : null
        }
        description={t("plans.description")}
        eyebrow={t("plans.eyebrow")}
        eyebrowIcon={<CalendarDays className="h-3.5 w-3.5" />}
        title={t("plans.title")}
      />

      {plans.length === 0 ? (
        <EmptyState
          action={
            isAdmin ? (
              <Link className={buttonClassName({ size: "sm" })} href="/plan/new">
                <PlusCircle className="h-3.5 w-3.5" />
                {t("plans.createFirstPlan")}
              </Link>
            ) : null
          }
          description={t("plans.emptyDescription")}
          icon={<CalendarDays className="h-5 w-5" />}
          title={t("plans.emptyTitle")}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <Card
              className={
                plan.isCurrent
                  ? "flex flex-col justify-between border-brand-border ring-1 ring-brand/20"
                  : "flex flex-col justify-between transition hover:border-border-strong"
              }
              key={plan.id}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-fg">{plan.name}</h2>
                  {plan.isCurrent ? (
                    <Badge tone="brand">{t("plans.currentBadge")}</Badge>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge icon={<CalendarRange className="h-3.5 w-3.5" />}>
                    {dateFormatter.formatDateRange(plan.startDate, plan.endDate)}
                  </Badge>
                  <Badge>{plural("common.days", plan.daysCount)}</Badge>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link
                  className={buttonClassName({ size: "sm" })}
                  href={`/plan/${plan.id}`}
                >
                  {t("common.openPlan")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  className={buttonClassName({ size: "sm", variant: "secondary" })}
                  href={`/plan/${plan.id}/grocery-list`}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  {t("common.groceryList")}
                </Link>
                {isAdmin && !plan.isCurrent ? (
                  <SetCurrentPlanButton
                    isCurrent={plan.isCurrent}
                    loadingLabel={t("common.settingAsCurrentShort")}
                    planId={plan.id}
                    size="sm"
                  />
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
