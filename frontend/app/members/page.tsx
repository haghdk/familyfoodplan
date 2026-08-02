import { Users } from "lucide-react";
import { adminSessionCookieName, backendApiUrl } from "../../lib/auth";
import { getTranslations } from "../../lib/i18n/server";
import MembersManager from "../../components/members/members-manager";
import PageHeader from "../../components/ui/PageHeader";
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
  const { t } = await getTranslations();

  return (
    <section className="space-y-6">
      <PageHeader
        description={t("members.description")}
        eyebrow={t("members.eyebrow")}
        eyebrowIcon={<Users className="h-3.5 w-3.5" />}
        title={t("members.title")}
      />
      <MembersManager initialMembers={members} />
    </section>
  );
}
