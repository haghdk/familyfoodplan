import { Archive } from "lucide-react";
import { cookies } from "next/headers";
import { adminSessionCookieName, backendApiUrl, userRoleCookieName } from "../../lib/auth";
import { getTranslations } from "../../lib/i18n/server";
import PantryManager, { type PantryItem } from "../../components/pantry/pantry-manager";
import PageHeader from "../../components/ui/PageHeader";

type PantryResponse = {
  pantryItems: PantryItem[];
  todayDayKey: string;
  expiryWarningDays: number;
};

const fallbackPantry: PantryResponse = {
  pantryItems: [],
  todayDayKey: new Date().toISOString().slice(0, 10),
  expiryWarningDays: 3
};

const getPantry = async (): Promise<PantryResponse> => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(adminSessionCookieName)?.value;

  try {
    const response = await fetch(`${backendApiUrl}/api/pantry-items`, {
      headers: {
        ...(sessionToken ? { Cookie: `${adminSessionCookieName}=${sessionToken}` } : {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return fallbackPantry;
    }

    return (await response.json()) as PantryResponse;
  } catch (_error) {
    return fallbackPantry;
  }
};

export default async function PantryPage() {
  const { pantryItems, todayDayKey, expiryWarningDays } = await getPantry();
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get(userRoleCookieName)?.value === "ADMIN";
  const { t } = await getTranslations();

  return (
    <section className="space-y-6">
      <PageHeader
        description={t("pantry.description")}
        eyebrow={t("pantry.eyebrow")}
        eyebrowIcon={<Archive className="h-3.5 w-3.5" />}
        title={t("pantry.title")}
      />
      <PantryManager
        canImportStocktake={isAdmin}
        expiryWarningDays={expiryWarningDays}
        initialPantryItems={pantryItems}
        todayDayKey={todayDayKey}
      />
    </section>
  );
}
