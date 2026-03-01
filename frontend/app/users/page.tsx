import { cookies } from "next/headers";
import { adminSessionCookieName, backendApiUrl } from "../../lib/auth";
import UsersManager from "../../components/users/users-manager";

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
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Users</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage admin and regular viewer accounts. Viewers can only read plans.
        </p>
      </div>
      <UsersManager initialUsers={users} />
    </section>
  );
}
