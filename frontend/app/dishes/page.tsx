import { CookingPot } from "lucide-react";
import { cookies } from "next/headers";
import { adminSessionCookieName, backendApiUrl } from "../../lib/auth";
import { getTranslations } from "../../lib/i18n/server";
import type { DishCategory } from "../../components/dishes/dish-categories-manager";
import DishesManager, { type Dish } from "../../components/dishes/dishes-manager";
import PageHeader from "../../components/ui/PageHeader";

/**
 * A read that says whether it worked, rather than quietly answering with an
 * empty list. The difference matters here: a cookbook with nothing in it and a
 * backend that could not be reached look identical once the failure is folded
 * into a `[]`, and "No dishes saved yet" on a screen that has fifty dishes is a
 * far worse answer than an error.
 */
type BackendRead<TResponse> =
  | { status: "ok"; data: TResponse }
  | { status: "failed" };

const readFromBackend = async <TResponse,>(
  path: string
): Promise<BackendRead<TResponse>> => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(adminSessionCookieName)?.value;

  try {
    const response = await fetch(`${backendApiUrl}${path}`, {
      headers: {
        ...(sessionToken ? { Cookie: `${adminSessionCookieName}=${sessionToken}` } : {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return { status: "failed" };
    }

    return { status: "ok", data: (await response.json()) as TResponse };
  } catch (_error) {
    return { status: "failed" };
  }
};

export default async function DishesPage() {
  // Fetched together: the dish list is grouped under the categories, so drawing
  // one without the other would show every dish as uncategorised.
  const [dishesRead, categoriesRead] = await Promise.all([
    readFromBackend<{ dishes: Dish[] }>("/api/dishes"),
    readFromBackend<{ dishCategories: DishCategory[] }>("/api/dish-categories")
  ]);

  // Whatever did arrive is still drawn. Categories failing on their own only
  // costs the grouping, so the dishes are worth showing either way — but the
  // screen says so rather than presenting a half-read cookbook as the whole one.
  const dishes = dishesRead.status === "ok" ? dishesRead.data.dishes : [];
  const dishCategories =
    categoriesRead.status === "ok" ? categoriesRead.data.dishCategories : [];
  const hasLoadFailure =
    dishesRead.status === "failed" || categoriesRead.status === "failed";
  const { t } = await getTranslations();

  return (
    <section className="space-y-6">
      <PageHeader
        description={t("dishes.description")}
        eyebrow={t("dishes.eyebrow")}
        eyebrowIcon={<CookingPot className="h-3.5 w-3.5" />}
        title={t("dishes.title")}
      />
      <DishesManager
        hasLoadFailure={hasLoadFailure}
        initialCategories={dishCategories}
        initialDishes={dishes}
      />
    </section>
  );
}
