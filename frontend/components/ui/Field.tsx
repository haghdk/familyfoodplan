"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import { useId } from "react";
import { cn } from "../../lib/cn";

export const controlClassName =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg " +
  "placeholder:text-fg-subtle transition focus:border-brand focus:outline-none " +
  "focus:ring-2 focus:ring-brand/25 disabled:bg-surface-muted disabled:text-fg-subtle";

export const labelClassName = "block text-sm font-medium text-fg";

type FieldShellProps = {
  label?: string;
  hint?: string;
  errorMessage?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
};

function FieldShell({
  label,
  hint,
  errorMessage,
  htmlFor,
  className,
  children
}: FieldShellProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label className={labelClassName} htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {hint && !errorMessage ? (
        <p className="text-xs text-fg-subtle">{hint}</p>
      ) : null}
      {errorMessage ? (
        <p className="text-xs font-medium text-danger">{errorMessage}</p>
      ) : null}
    </div>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  errorMessage?: string;
  fieldClassName?: string;
};

export function TextField({
  label,
  hint,
  errorMessage,
  fieldClassName,
  className,
  id,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldShell
      className={fieldClassName}
      errorMessage={errorMessage}
      hint={hint}
      htmlFor={inputId}
      label={label}
    >
      <input
        className={cn(
          controlClassName,
          errorMessage && "border-danger focus:border-danger focus:ring-danger/25",
          className
        )}
        id={inputId}
        {...inputProps}
      />
    </FieldShell>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  errorMessage?: string;
  fieldClassName?: string;
};

export function SelectField({
  label,
  hint,
  errorMessage,
  fieldClassName,
  className,
  id,
  children,
  ...selectProps
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <FieldShell
      className={fieldClassName}
      errorMessage={errorMessage}
      hint={hint}
      htmlFor={selectId}
      label={label}
    >
      <select className={cn(controlClassName, className)} id={selectId} {...selectProps}>
        {children}
      </select>
    </FieldShell>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  errorMessage?: string;
  fieldClassName?: string;
};

export function TextAreaField({
  label,
  hint,
  errorMessage,
  fieldClassName,
  className,
  id,
  ...textAreaProps
}: TextAreaFieldProps) {
  const generatedId = useId();
  const textAreaId = id ?? generatedId;

  return (
    <FieldShell
      className={fieldClassName}
      errorMessage={errorMessage}
      hint={hint}
      htmlFor={textAreaId}
      label={label}
    >
      <textarea
        className={cn(controlClassName, "resize-y", className)}
        id={textAreaId}
        {...textAreaProps}
      />
    </FieldShell>
  );
}
