"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPlanAsCurrent } from "../../lib/plans";

type SetCurrentPlanButtonProps = {
  planId: number;
  isCurrent: boolean;
  idleLabel: string;
  loadingLabel?: string;
};

export default function SetCurrentPlanButton({
  planId,
  isCurrent,
  idleLabel,
  loadingLabel = "Setting as current..."
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
    <div className="space-y-2">
      <button
        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isCurrent || isSubmitting}
        onClick={handleSetCurrent}
        type="button"
      >
        {isCurrent ? "Current plan" : isSubmitting ? loadingLabel : idleLabel}
      </button>
      {errorMessage ? <p className="text-sm text-rose-700">{errorMessage}</p> : null}
    </div>
  );
}
