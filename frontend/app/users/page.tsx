import { cookies } from "next/headers";
import { ShieldUser } from "lucide-react";
import { adminSessionCookieName, backendApiUrl } from "../../lib/auth";
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

  return (
    <section className="space-y-6">
      <PageHeader
        description="Manage admin and regular viewer accounts. Viewers can only read plans."
        eyebrow="Access"
        eyebrowIcon={<ShieldUser className="h-3.5 w-3.5" />}
        title="Users"
      />
      <UsersManager initialUsers={users} />
    </section>
  );
}
