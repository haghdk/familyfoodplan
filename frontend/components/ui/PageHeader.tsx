import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  eyebrowIcon?: ReactNode;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export default function PageHeader({
  title,
  eyebrow,
  eyebrowIcon,
  description,
  actions,
  className
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="space-y-2">
        {eyebrow ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            {eyebrowIcon}
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-prose text-sm text-fg-muted">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
