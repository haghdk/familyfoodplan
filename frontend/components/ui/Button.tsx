import type { ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "dangerSolid"
  | "soft";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const baseClassName =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-canvas disabled:opacity-55 disabled:shadow-none";

const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-brand-fg shadow-card hover:bg-brand-strong active:translate-y-px",
  secondary:
    "border border-border-strong bg-surface text-fg hover:border-brand hover:text-brand active:translate-y-px",
  ghost: "text-fg-muted hover:bg-surface-muted hover:text-fg",
  danger:
    "border border-danger-border bg-danger-soft text-danger hover:bg-danger hover:text-surface active:translate-y-px",
  dangerSolid:
    "bg-danger text-surface shadow-card hover:bg-danger/90 focus-visible:ring-danger/45 active:translate-y-px",
  soft: "bg-brand-soft text-brand hover:bg-brand hover:text-brand-fg active:translate-y-px"
};

const sizeClassNames: Record<ButtonSize, string> = {
  sm: "px-3.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
  icon: "h-9 w-9 p-0"
};

export const buttonClassName = ({
  variant = "primary",
  size = "md",
  className
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) =>
  cn(baseClassName, variantClassNames[variant], sizeClassNames[size], className);

type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export default function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      className={buttonClassName({ variant, size, className })}
      type={type}
      {...buttonProps}
    />
  );
}
