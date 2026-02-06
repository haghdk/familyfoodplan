"use client";

import { useState } from "react";
import { backendApiUrl } from "../../lib/auth";
import MemberForm from "./member-form";

type Member = {
  id: number;
  name: string;
  isActive: boolean;
};

type MembersManagerProps = {
  initialMembers: Member[];
};

export default function MembersManager({ initialMembers }: MembersManagerProps) {
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
        headers: { "Content-Type": "application/json" },
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
      setErrorMessage("Could not create member right now.");
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
        headers: { "Content-Type": "application/json" },
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
      setErrorMessage("Could not update member right now.");
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
      setErrorMessage("Could not archive member right now.");
    } finally {
      setIsSavingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Add member</h2>
        <p className="mt-1 text-sm text-slate-600">
          Add the people you are planning meals for this week.
        </p>
        <div className="mt-4">
          <MemberForm
            isSubmitting={isCreating}
            onSubmit={createMember}
            submitLabel="Add member"
          />
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-3">
        {members.map((member) => (
          <article
            key={member.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            {editingMemberId === member.id ? (
              <MemberForm
                initialName={member.name}
                isSubmitting={isSavingId === member.id}
                onCancel={() => setEditingMemberId(null)}
                onSubmit={(name) => updateMember(member.id, name)}
                submitLabel="Save"
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{member.name}</p>
                  <p className="text-sm text-slate-600">
                    {member.isActive ? "Active" : "Archived"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSavingId === member.id}
                    onClick={() => setEditingMemberId(member.id)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!member.isActive || isSavingId === member.id}
                    onClick={() => archiveMember(member.id)}
                    type="button"
                  >
                    Archive
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
