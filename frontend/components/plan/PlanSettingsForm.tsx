"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { backendApiUrl } from "../../lib/auth";
import ConfirmModal from "../ui/ConfirmModal";

type PlanSettingsFormProps = {
  planId: number;
  initialName: string;
  initialStartDate: string | null;
  initialEndDate: string | null;
};

export default function PlanSettingsForm({
  planId,
  initialName,
  initialStartDate,
  initialEndDate
}: PlanSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [endDate, setEndDate] = useState(initialEndDate ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const savePlanSettings = async () => {
    const normalizedName = name.trim();

    if (!normalizedName) {
      setFeedback({ type: "error", message: "Plan title is required." });
      return;
    }

    if (!startDate || !endDate) {
      setFeedback({ type: "error", message: "Both start and end dates are required." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch(`${backendApiUrl}/api/plans/${planId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          name: normalizedName,
          startDate,
          endDate
        })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        setFeedback({
          type: "error",
          message: data?.message ?? "Could not update this plan right now."
        });
        return;
      }

      setFeedback({ type: "success", message: "Plan updated." });
      router.refresh();
    } catch (_error) {
      setFeedback({ type: "error", message: "Could not update this plan right now." });
    } finally {
      setIsSaving(false);
    }
  };

  const deletePlan = async () => {
    setIsDeleting(true);
    setFeedback(null);

    try {
      const response = await fetch(`${backendApiUrl}/api/plans/${planId}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        setFeedback({
          type: "error",
          message: data?.message ?? "Could not delete this plan right now."
        });
        return;
      }

      setIsDeleteModalOpen(false);
      router.push("/plan");
      router.refresh();
    } catch (_error) {
      setFeedback({ type: "error", message: "Could not delete this plan right now." });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Plan settings</h2>
          <button
            aria-label="Delete plan"
            className="rounded-full p-2 text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:text-rose-300"
            disabled={isDeleting}
            onClick={() => setIsDeleteModalOpen(true)}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Title</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Start date</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              onChange={(event) => setStartDate(event.target.value)}
              type="date"
              value={startDate}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">End date</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              onChange={(event) => setEndDate(event.target.value)}
              type="date"
              value={endDate}
            />
          </label>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
            disabled={isSaving || isDeleting}
            onClick={savePlanSettings}
            type="button"
          >
            {isSaving ? "Saving..." : "Save settings"}
          </button>
          {feedback ? (
            <p
              className={`text-sm ${
                feedback.type === "success" ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {feedback.message}
            </p>
          ) : null}
        </div>
      </section>

      <ConfirmModal
        cancelLabel="Cancel"
        confirmLabel="Delete plan"
        confirmVariant="danger"
        description="This action cannot be undone. Deleting this food plan will also delete its grocery list."
        isLoading={isDeleting}
        isOpen={isDeleteModalOpen}
        onCancel={() => setIsDeleteModalOpen(false)}
        onConfirm={deletePlan}
        title="Delete this plan?"
      />
    </>
  );
}
