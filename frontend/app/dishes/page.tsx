import { CookingPot } from "lucide-react";
import { cookies } from "next/headers";
import { adminSessionCookieName, backendApiUrl } from "../../lib/auth";
import { getTranslations } from "../../lib/i18n/server";
import DishesManager, { type Dish } from "../../components/dishes/dishes-manager";
import PageHeader from "../../components/ui/PageHeader";

const getDishes = async (): Promise<Dish[]> => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(adminSessionCookieName)?.value;

  try {
    const response = await fetch(`${backendApiUrl}/api/dishes`, {
      headers: {
        ...(sessionToken ? { Cookie: `${adminSessionCookieName}=${sessionToken}` } : {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { dishes: Dish[] };
    return data.dishes;
  } catch (_error) {
    return [];
  }
};

export default async function DishesPage() {
  const dishes = await getDishes();
  const { t } = await getTranslations();

  return (
    <section className="space-y-6">
      <PageHeader
        description={t("dishes.description")}
        eyebrow={t("dishes.eyebrow")}
        eyebrowIcon={<CookingPot className="h-3.5 w-3.5" />}
        title={t("dishes.title")}
      />
      <DishesManager initialDishes={dishes} />
    </section>
  );
}
