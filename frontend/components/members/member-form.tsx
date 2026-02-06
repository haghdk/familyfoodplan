"use client";

import { FormEvent, useMemo, useState } from "react";

type MemberFormProps = {
  initialName?: string;
  isSubmitting: boolean;
  onSubmit: (name: string) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
};

const minNameLength = 2;

export default function MemberForm({
  initialName = "",
  isSubmitting,
  onSubmit,
  onCancel,
  submitLabel
}: MemberFormProps) {
  const [name, setName] = useState(initialName);
  const [errorMessage, setErrorMessage] = useState("");

  const trimmedName = useMemo(() => name.trim(), [name]);

  const validate = (): string => {
    if (!trimmedName) {
      return "Name is required.";
    }

    if (trimmedName.length < minNameLength) {
      return `Name must be at least ${minNameLength} characters.`;
    }

    if (trimmedName.length > 80) {
      return "Name must be 80 characters or fewer.";
    }

    return "";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextError = validate();

    if (nextError) {
      setErrorMessage(nextError);
      return;
    }

    setErrorMessage("");
    await onSubmit(trimmedName);

    if (!initialName) {
      setName("");
    }
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <label className="block text-sm font-medium text-slate-700" htmlFor="member-name">
        Name
      </label>
      <input
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
        id="member-name"
        maxLength={80}
        onChange={(event) => setName(event.target.value)}
        placeholder="Enter family member name"
        value={name}
      />

      {errorMessage ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </button>

        {onCancel ? (
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
