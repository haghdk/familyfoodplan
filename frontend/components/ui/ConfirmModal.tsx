"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import Button from "./Button";

type ConfirmVariant = "default" | "danger";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: ConfirmVariant;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmVariant = "default",
  isLoading = false,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    confirmButtonRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  const isDanger = confirmVariant === "danger";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fg/45 px-4 backdrop-blur-sm">
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-lifted"
        role="dialog"
      >
        <div className="flex items-start gap-3">
          {isDanger ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-danger-soft text-danger">
              <AlertTriangle className="h-5 w-5" />
            </span>
          ) : null}
          <div>
            <h3 className="text-base font-semibold text-fg" id={titleId}>
              {title}
            </h3>
            <p className="mt-1.5 text-sm text-fg-muted" id={descriptionId}>
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button disabled={isLoading} onClick={onCancel} variant="secondary">
            {cancelLabel}
          </Button>
          <Button
            disabled={isLoading}
            onClick={onConfirm}
            ref={confirmButtonRef}
            variant={isDanger ? "dangerSolid" : "primary"}
          >
            {isLoading ? "Working..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
