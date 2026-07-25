import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type CardProps = {
  children: ReactNode;
  className?: string;
  padded?: boolean;
};

export default function Card({ children, className, padded = true }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-surface shadow-card",
        padded && "p-5 sm:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

type SectionCardProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function SectionCard({
  title,
  description,
  icon,
  actions,
  children,
  className,
  bodyClassName
}: SectionCardProps) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {icon ? (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              {icon}
            </span>
          ) : null}
          <div>
            <h2 className="text-base font-semibold text-fg">{title}</h2>
            {description ? (
              <p className="mt-1 max-w-prose text-sm text-fg-muted">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className={cn("mt-5", bodyClassName)}>{children}</div>
    </Card>
  );
}
