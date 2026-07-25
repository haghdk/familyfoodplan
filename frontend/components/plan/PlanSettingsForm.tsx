"use client";

import { Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { backendApiUrl } from "../../lib/auth";
import Button from "../ui/Button";
import { SectionCard } from "../ui/Card";
import { TextField } from "../ui/Field";
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
      <SectionCard
        actions={
          <Button
            aria-label="Delete plan"
            disabled={isDeleting}
            onClick={() => setIsDeleteModalOpen(true)}
            size="icon"
            variant="danger"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        }
        description="Rename the plan or move its date range. Days are added or removed to match."
        icon={<Settings2 className="h-4 w-4" />}
        title="Plan settings"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <TextField
            label="Title"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          <TextField
            label="Start date"
            onChange={(event) => setStartDate(event.target.value)}
            type="date"
            value={startDate}
          />
          <TextField
            label="End date"
            onChange={(event) => setEndDate(event.target.value)}
            type="date"
            value={endDate}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button disabled={isSaving || isDeleting} onClick={savePlanSettings}>
            {isSaving ? "Saving..." : "Save settings"}
          </Button>
          {feedback ? (
            <p
              className={`text-sm font-medium ${
                feedback.type === "success" ? "text-success" : "text-danger"
              }`}
            >
              {feedback.message}
            </p>
          ) : null}
        </div>
      </SectionCard>

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
