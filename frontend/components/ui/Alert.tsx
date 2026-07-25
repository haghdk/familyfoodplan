import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "../../lib/cn";

export type AlertTone = "info" | "success" | "warning" | "error";

const toneClassNames: Record<AlertTone, string> = {
  info: "border-border bg-surface-muted text-fg-muted",
  success: "border-success-border bg-success-soft text-success",
  warning: "border-warning-border bg-warning-soft text-warning",
  error: "border-danger-border bg-danger-soft text-danger"
};

const toneIcons: Record<AlertTone, ReactNode> = {
  info: <Info className="h-4 w-4 shrink-0" />,
  success: <CheckCircle2 className="h-4 w-4 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0" />,
  error: <XCircle className="h-4 w-4 shrink-0" />
};

type AlertProps = {
  children: ReactNode;
  tone?: AlertTone;
  className?: string;
};

export default function Alert({ children, tone = "info", className }: AlertProps) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-2xl border px-3.5 py-2.5 text-sm",
        toneClassNames[tone],
        className
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      {toneIcons[tone]}
      <span>{children}</span>
    </p>
  );
}
