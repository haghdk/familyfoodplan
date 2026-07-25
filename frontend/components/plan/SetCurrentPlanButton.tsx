"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Star } from "lucide-react";
import { setPlanAsCurrent } from "../../lib/plans";
import Button, { type ButtonSize } from "../ui/Button";

type SetCurrentPlanButtonProps = {
  planId: number;
  isCurrent: boolean;
  idleLabel: string;
  loadingLabel?: string;
  size?: ButtonSize;
};

export default function SetCurrentPlanButton({
  planId,
  isCurrent,
  idleLabel,
  loadingLabel = "Setting as current...",
  size = "md"
}: SetCurrentPlanButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSetCurrent = async () => {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await setPlanAsCurrent(planId);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Could not set this as the current plan right now.";
      setErrorMessage(message);
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
        {isCurrent ? "Current plan" : isSubmitting ? loadingLabel : idleLabel}
      </Button>
      {errorMessage ? (
        <p className="text-xs font-medium text-danger">{errorMessage}</p>
      ) : null}
    </div>
  );
}
