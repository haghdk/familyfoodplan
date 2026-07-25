import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "accent"
  | "warning"
  | "danger"
  | "breakfast"
  | "lunch"
  | "dinner";

const toneClassNames: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface-muted text-fg-muted",
  brand: "border-brand-border bg-brand-soft text-brand",
  accent: "border-accent-border bg-accent-soft text-accent",
  warning: "border-warning-border bg-warning-soft text-warning",
  danger: "border-danger-border bg-danger-soft text-danger",
  breakfast: "border-breakfast/25 bg-breakfast-soft text-breakfast",
  lunch: "border-lunch/25 bg-lunch-soft text-lunch",
  dinner: "border-dinner/25 bg-dinner-soft text-dinner"
};

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
};

export default function Badge({
  children,
  tone = "neutral",
  icon,
  className
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        toneClassNames[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}
