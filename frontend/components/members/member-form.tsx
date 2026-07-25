"use client";

import { FormEvent, useMemo, useState } from "react";
import Button from "../ui/Button";
import { TextField } from "../ui/Field";

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
    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleSubmit}>
      <TextField
        errorMessage={errorMessage}
        fieldClassName="flex-1"
        label="Name"
        maxLength={80}
        onChange={(event) => setName(event.target.value)}
        placeholder="Enter family member name"
        value={name}
      />

      <div className="flex gap-2">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>

        {onCancel ? (
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
