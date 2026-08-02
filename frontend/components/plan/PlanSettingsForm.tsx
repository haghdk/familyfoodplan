"use client";

import { Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { backendApiUrl } from "../../lib/auth";
import { useTranslations } from "../../lib/i18n/client";
import { localeHeader } from "../../lib/i18n/requestHeaders";
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
  const { locale, t } = useTranslations();
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
      setFeedback({ type: "error", message: t("planSettings.titleRequired") });
      return;
    }

    if (!startDate || !endDate) {
      setFeedback({ type: "error", message: t("planSettings.datesRequired") });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch(`${backendApiUrl}/api/plans/${planId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...localeHeader(locale)
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
          message: data?.message ?? t("planSettings.updateFailed")
        });
        return;
      }

      setFeedback({ type: "success", message: t("planSettings.updated") });
      router.refresh();
    } catch (_error) {
      setFeedback({ type: "error", message: t("planSettings.updateFailed") });
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
        headers: localeHeader(locale),
        credentials: "include"
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        setFeedback({
          type: "error",
          message: data?.message ?? t("planSettings.deleteFailed")
        });
        return;
      }

      setIsDeleteModalOpen(false);
      router.push("/plan");
      router.refresh();
    } catch (_error) {
      setFeedback({ type: "error", message: t("planSettings.deleteFailed") });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <SectionCard
        actions={
          <Button
            aria-label={t("planSettings.deleteAriaLabel")}
            disabled={isDeleting}
            onClick={() => setIsDeleteModalOpen(true)}
            size="icon"
            variant="danger"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        }
        description={t("planSettings.description")}
        icon={<Settings2 className="h-4 w-4" />}
        title={t("planSettings.title")}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <TextField
            label={t("planSettings.titleLabel")}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          <TextField
            label={t("common.startDate")}
            onChange={(event) => setStartDate(event.target.value)}
            type="date"
            value={startDate}
          />
          <TextField
            label={t("common.endDate")}
            onChange={(event) => setEndDate(event.target.value)}
            type="date"
            value={endDate}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button disabled={isSaving || isDeleting} onClick={savePlanSettings}>
            {isSaving ? t("common.saving") : t("planSettings.submit")}
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
        cancelLabel={t("common.cancel")}
        confirmLabel={t("planSettings.deleteConfirm")}
        confirmVariant="danger"
        description={t("planSettings.deleteDescription")}
        isLoading={isDeleting}
        isOpen={isDeleteModalOpen}
        onCancel={() => setIsDeleteModalOpen(false)}
        onConfirm={deletePlan}
        title={t("planSettings.deleteTitle")}
      />
    </>
  );
}
