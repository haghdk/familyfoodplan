import { adminSessionCookieName, backendApiUrl } from "../../lib/auth";
import MembersManager from "../../components/members/members-manager";
import { cookies } from "next/headers";

type Member = {
  id: number;
  name: string;
  isActive: boolean;
};

const getMembers = async (): Promise<Member[]> => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(adminSessionCookieName)?.value;

  try {
    const response = await fetch(`${backendApiUrl}/api/members`, {
      headers: {
        ...(sessionToken ? { Cookie: `${adminSessionCookieName}=${sessionToken}` } : {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { members: Member[] };
    return data.members;
  } catch (_error) {
    return [];
  }
};

export default async function MembersPage() {
  const members = await getMembers();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Family members</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage who is included in your family meal planning.
        </p>
      </div>
      <MembersManager initialMembers={members} />
    </section>
  );
}
