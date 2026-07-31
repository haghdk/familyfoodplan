"use client";

import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "../../lib/cn";

type ToggleSettingProps = {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Rendered under the description, for status or error text. */
  footer?: ReactNode;
  className?: string;
};

/**
 * A labelled on/off row for the settings screen. Built on a real checkbox with
 * `role="switch"`, so keyboard and screen reader behaviour comes for free.
 */
export default function ToggleSetting({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  footer,
  className
}: ToggleSettingProps) {
  const inputId = useId();
  const descriptionId = `${inputId}-description`;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-surface-muted/40 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className
      )}
    >
      <div className="space-y-1">
        <label className="text-sm font-semibold text-fg" htmlFor={inputId}>
          {label}
        </label>
        {description ? (
          <p className="max-w-prose text-sm text-fg-muted" id={descriptionId}>
            {description}
          </p>
        ) : null}
        {footer}
      </div>

      <label
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition",
          "focus-within:ring-2 focus-within:ring-brand/45 focus-within:ring-offset-2 focus-within:ring-offset-canvas",
          checked ? "bg-brand" : "bg-border-strong",
          disabled && "cursor-not-allowed opacity-55"
        )}
        htmlFor={inputId}
      >
        <input
          aria-describedby={description ? descriptionId : undefined}
          checked={checked}
          className="peer sr-only"
          disabled={disabled}
          id={inputId}
          onChange={(event) => onChange(event.target.checked)}
          role="switch"
          type="checkbox"
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none ml-0.5 h-5 w-5 rounded-full bg-surface shadow-card transition",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </label>
    </div>
  );
}
