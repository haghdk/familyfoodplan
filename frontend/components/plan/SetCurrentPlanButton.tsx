"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Star } from "lucide-react";
import { useTranslations } from "../../lib/i18n/client";
import { setPlanAsCurrent } from "../../lib/plans";
import Button, { type ButtonSize } from "../ui/Button";

type SetCurrentPlanButtonProps = {
  planId: number;
  isCurrent: boolean;
  /** Overrides the default "Setting as current..." where space is tight. */
  loadingLabel?: string;
  size?: ButtonSize;
};

export default function SetCurrentPlanButton({
  planId,
  isCurrent,
  loadingLabel,
  size = "md"
}: SetCurrentPlanButtonProps) {
  const router = useRouter();
  const { locale, t } = useTranslations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSetCurrent = async () => {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await setPlanAsCurrent(planId, locale);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setErrorMessage(message || t("common.setCurrentFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Button
        disabled={isCurrent || isSubmitting}
        onClick={handleSetCurrent}
        size={size}
        variant="secondary"
      >
        {isCurrent ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Star className="h-4 w-4" />
        )}
        {isCurrent
          ? t("common.currentPlan")
          : isSubmitting
            ? (loadingLabel ?? t("common.settingAsCurrent"))
            : t("common.setAsCurrent")}
      </Button>
      {errorMessage ? (
        <p className="text-xs font-medium text-danger">{errorMessage}</p>
      ) : null}
    </div>
  );
}
