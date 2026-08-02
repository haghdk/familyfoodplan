import { cookies } from "next/headers";
import { ShieldUser } from "lucide-react";
import { adminSessionCookieName, backendApiUrl } from "../../lib/auth";
import { getTranslations } from "../../lib/i18n/server";
import UsersManager from "../../components/users/users-manager";
import PageHeader from "../../components/ui/PageHeader";

type User = {
  id: number;
  email: string;
  role: "ADMIN" | "VIEWER";
};

const getUsers = async (): Promise<User[]> => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(adminSessionCookieName)?.value;

  try {
    const response = await fetch(`${backendApiUrl}/api/users`, {
      headers: {
        ...(sessionToken ? { Cookie: `${adminSessionCookieName}=${sessionToken}` } : {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { users: User[] };
    return data.users;
  } catch (_error) {
    return [];
  }
};

export default async function UsersPage() {
  const users = await getUsers();
  const { t } = await getTranslations();

  return (
    <section className="space-y-6">
      <PageHeader
        description={t("users.description")}
        eyebrow={t("users.eyebrow")}
        eyebrowIcon={<ShieldUser className="h-3.5 w-3.5" />}
        title={t("users.title")}
      />
      <UsersManager initialUsers={users} />
    </section>
  );
}
