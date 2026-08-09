import { CookingPot } from "lucide-react";
import { cookies } from "next/headers";
import { adminSessionCookieName, backendApiUrl } from "../../lib/auth";
import { getTranslations } from "../../lib/i18n/server";
import type { DishCategory } from "../../components/dishes/dish-categories-manager";
import DishesManager, { type Dish } from "../../components/dishes/dishes-manager";
import PageHeader from "../../components/ui/PageHeader";

const readFromBackend = async <TResponse,>(
  path: string,
  fallback: TResponse
): Promise<TResponse> => {
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
      return fallback;
    }

    return (await response.json()) as TResponse;
  } catch (_error) {
    return fallback;
  }
};

export default async function DishesPage() {
  // Fetched together: the dish list is grouped under the categories, so drawing
  // one without the other would show every dish as uncategorised.
  const [{ dishes }, { dishCategories }] = await Promise.all([
    readFromBackend<{ dishes: Dish[] }>("/api/dishes", { dishes: [] }),
    readFromBackend<{ dishCategories: DishCategory[] }>("/api/dish-categories", {
      dishCategories: []
    })
  ]);
  const { t } = await getTranslations();

  return (
    <section className="space-y-6">
      <PageHeader
        description={t("dishes.description")}
        eyebrow={t("dishes.eyebrow")}
        eyebrowIcon={<CookingPot className="h-3.5 w-3.5" />}
        title={t("dishes.title")}
      />
      <DishesManager initialCategories={dishCategories} initialDishes={dishes} />
    </section>
  );
}
