"use client";

import { FormEvent, useMemo, useState } from "react";
import { useTranslations } from "../../lib/i18n/client";
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
const maxNameLength = 80;

export default function MemberForm({
  initialName = "",
  isSubmitting,
  onSubmit,
  onCancel,
  submitLabel
}: MemberFormProps) {
  const { t, plural } = useTranslations();
  const [name, setName] = useState(initialName);
  const [errorMessage, setErrorMessage] = useState("");

  const trimmedName = useMemo(() => name.trim(), [name]);

  const validate = (): string => {
    if (!trimmedName) {
      return t("members.nameRequired");
    }

    if (trimmedName.length < minNameLength) {
      return plural("members.nameTooShort", minNameLength);
    }

    if (trimmedName.length > maxNameLength) {
      return plural("members.nameTooLong", maxNameLength);
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
        label={t("common.name")}
        maxLength={maxNameLength}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("members.namePlaceholder")}
        value={name}
      />

      <div className="flex gap-2">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? t("common.saving") : submitLabel}
        </Button>

        {onCancel ? (
          <Button onClick={onCancel} variant="secondary">
            {t("common.cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
