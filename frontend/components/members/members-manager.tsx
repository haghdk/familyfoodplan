"use client";

import { useState } from "react";
import { Archive, Pencil, UserPlus, Users } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import { useTranslations } from "../../lib/i18n/client";
import { localeHeader } from "../../lib/i18n/requestHeaders";
import MemberForm from "./member-form";
import Alert from "../ui/Alert";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card, { SectionCard } from "../ui/Card";
import EmptyState from "../ui/EmptyState";

type Member = {
  id: number;
  name: string;
  isActive: boolean;
};

type MembersManagerProps = {
  initialMembers: Member[];
};

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

export default function MembersManager({ initialMembers }: MembersManagerProps) {
  const { locale, t } = useTranslations();
  const [members, setMembers] = useState(initialMembers);
  const [isCreating, setIsCreating] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [isSavingId, setIsSavingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const createMember = async (name: string) => {
    setIsCreating(true);
    setErrorMessage("");

    const optimisticId = -Date.now();
    const optimisticMember: Member = { id: optimisticId, name, isActive: true };
    setMembers((currentMembers) => [optimisticMember, ...currentMembers]);

    try {
      const response = await fetch(`${backendApiUrl}/api/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify({ name })
      });

      if (!response.ok) {
        throw new Error("Unable to create member.");
      }

      const data = (await response.json()) as { member: Member };
      setMembers((currentMembers) =>
        currentMembers.map((member) =>
          member.id === optimisticId ? data.member : member
        )
      );
    } catch (_error) {
      setMembers((currentMembers) =>
        currentMembers.filter((member) => member.id !== optimisticId)
      );
      setErrorMessage(t("members.createFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  const updateMember = async (memberId: number, name: string) => {
    const existingMember = members.find((member) => member.id === memberId);

    if (!existingMember) {
      return;
    }

    setIsSavingId(memberId);
    setErrorMessage("");
    setMembers((currentMembers) =>
      currentMembers.map((member) =>
        member.id === memberId ? { ...member, name } : member
      )
    );

    try {
      const response = await fetch(`${backendApiUrl}/api/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify({ name })
      });

      if (!response.ok) {
        throw new Error("Unable to update member.");
      }

      const data = (await response.json()) as { member: Member };
      setMembers((currentMembers) =>
        currentMembers.map((member) =>
          member.id === memberId ? data.member : member
        )
      );
      setEditingMemberId(null);
    } catch (_error) {
      setMembers((currentMembers) =>
        currentMembers.map((member) =>
          member.id === memberId ? existingMember : member
        )
      );
      setErrorMessage(t("members.updateFailed"));
    } finally {
      setIsSavingId(null);
    }
  };

  const archiveMember = async (memberId: number) => {
    const existingMember = members.find((member) => member.id === memberId);

    if (!existingMember) {
      return;
    }

    setIsSavingId(memberId);
    setErrorMessage("");
    setMembers((currentMembers) =>
      currentMembers.map((member) =>
        member.id === memberId ? { ...member, isActive: false } : member
      )
    );

    try {
      const response = await fetch(`${backendApiUrl}/api/members/${memberId}/archive`, {
        method: "PATCH",
        headers: localeHeader(locale),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Unable to archive member.");
      }

      const data = (await response.json()) as { member: Member };
      setMembers((currentMembers) =>
        currentMembers.map((member) =>
          member.id === memberId ? data.member : member
        )
      );
    } catch (_error) {
      setMembers((currentMembers) =>
        currentMembers.map((member) =>
          member.id === memberId ? existingMember : member
        )
      );
      setErrorMessage(t("members.archiveFailed"));
    } finally {
      setIsSavingId(null);
    }
  };

  const activeMembersCount = members.filter((member) => member.isActive).length;

  return (
    <section className="space-y-5">
      <SectionCard
        description={t("members.addDescription")}
        icon={<UserPlus className="h-4 w-4" />}
        title={t("members.addTitle")}
      >
        <MemberForm
          isSubmitting={isCreating}
          onSubmit={createMember}
          submitLabel={t("members.addSubmit")}
        />
      </SectionCard>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      {members.length === 0 ? (
        <EmptyState
          description={t("members.emptyDescription")}
          icon={<Users className="h-5 w-5" />}
          title={t("members.emptyTitle")}
        />
      ) : (
        <>
          <p className="text-sm text-fg-muted">
            {t("members.activeCount", { count: activeMembersCount })}
            {members.length - activeMembersCount > 0
              ? t("members.archivedCount", {
                  count: members.length - activeMembersCount
                })
              : ""}
          </p>

          <ul className="space-y-3">
            {members.map((member) => (
              <li key={member.id}>
                <Card className="p-4 sm:p-4">
                  {editingMemberId === member.id ? (
                    <MemberForm
                      initialName={member.name}
                      isSubmitting={isSavingId === member.id}
                      onCancel={() => setEditingMemberId(null)}
                      onSubmit={(name) => updateMember(member.id, name)}
                      submitLabel={t("common.save")}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={
                            member.isActive
                              ? "flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-soft text-sm font-semibold text-brand"
                              : "flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-muted text-sm font-semibold text-fg-subtle"
                          }
                        >
                          {getInitials(member.name)}
                        </span>
                        <div>
                          <p className="font-semibold text-fg">{member.name}</p>
                          <Badge tone={member.isActive ? "brand" : "neutral"}>
                            {member.isActive
                              ? t("members.active")
                              : t("members.archived")}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          disabled={isSavingId === member.id}
                          onClick={() => setEditingMemberId(member.id)}
                          size="sm"
                          variant="secondary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t("common.edit")}
                        </Button>
                        <Button
                          disabled={!member.isActive || isSavingId === member.id}
                          onClick={() => archiveMember(member.id)}
                          size="sm"
                          variant="danger"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          {t("members.archive")}
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
