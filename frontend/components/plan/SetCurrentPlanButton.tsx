"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarX, CheckCircle2, Star } from "lucide-react";
import { useTranslations } from "../../lib/i18n/client";
import { setPlanAsCurrent } from "../../lib/plans";
import Button, { type ButtonSize } from "../ui/Button";

type SetCurrentPlanButtonProps = {
  planId: number;
  isCurrent: boolean;
  /**
   * Whether the plan's last day is already behind us, as the backend reckons
   * it. Taken from the API rather than worked out here, so the button and the
   * guard that refuses the request cannot disagree about what day it is.
   */
  hasEnded?: boolean;
  /** Overrides the default "Setting as current..." where space is tight. */
  loadingLabel?: string;
  size?: ButtonSize;
};

export default function SetCurrentPlanButton({
  planId,
  isCurrent,
  hasEnded = false,
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

  // A plan that has run out is offered as a disabled, labelled button rather
  // than no button at all: "Plan has ended" answers the question the missing
  // control would raise.
  const isEndedAndNotCurrent = hasEnded && !isCurrent;

  const buttonLabel = () => {
    if (isCurrent) {
      return t("common.currentPlan");
    }

    if (isEndedAndNotCurrent) {
      return t("common.planEnded");
    }

    return isSubmitting
      ? (loadingLabel ?? t("common.settingAsCurrent"))
      : t("common.setAsCurrent");
  };

  return (
    <div className="space-y-1.5">
      <Button
        disabled={isCurrent || isEndedAndNotCurrent || isSubmitting}
        onClick={handleSetCurrent}
        size={size}
        title={isEndedAndNotCurrent ? t("common.planEndedHint") : undefined}
        variant="secondary"
      >
        {isCurrent ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : isEndedAndNotCurrent ? (
          <CalendarX className="h-4 w-4" />
        ) : (
          <Star className="h-4 w-4" />
        )}
        {buttonLabel()}
      </Button>
      {isEndedAndNotCurrent ? (
        <p className="text-xs text-fg-subtle">{t("common.planEndedHint")}</p>
      ) : null}
      {errorMessage ? (
        <p className="text-xs font-medium text-danger">{errorMessage}</p>
      ) : null}
    </div>
  );
}
