"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "../../lib/i18n/client";
import Button from "../ui/Button";
import { TextField } from "../ui/Field";

export type PantryFormValues = {
  name: string;
  quantity: number;
  unit: string | null;
  expirationDate: string | null;
  notes: string | null;
};

type PantryFormProps = {
  initialName?: string;
  initialQuantity?: number;
  initialUnit?: string;
  initialExpirationDate?: string;
  initialNotes?: string;
  isSubmitting: boolean;
  onSubmit: (values: PantryFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
};

export default function PantryForm({
  initialName = "",
  initialQuantity = 1,
  initialUnit = "",
  initialExpirationDate = "",
  initialNotes = "",
  isSubmitting,
  onSubmit,
  onCancel,
  submitLabel
}: PantryFormProps) {
  const { t } = useTranslations();
  const [name, setName] = useState(initialName);
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [unit, setUnit] = useState(initialUnit);
  const [expirationDate, setExpirationDate] = useState(initialExpirationDate);
  const [notes, setNotes] = useState(initialNotes);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setErrorMessage(t("pantry.nameRequired"));
      return;
    }

    setErrorMessage("");

    await onSubmit({
      name: trimmedName,
      quantity: Number(quantity) || 1,
      unit: unit.trim() || null,
      expirationDate: expirationDate || null,
      notes: notes.trim() || null
    });

    if (!initialName) {
      setName("");
      setQuantity("1");
      setUnit("");
      setExpirationDate("");
      setNotes("");
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-6">
        <TextField
          errorMessage={errorMessage}
          fieldClassName="sm:col-span-2"
          label={t("common.name")}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("pantry.namePlaceholder")}
          value={name}
        />
        <TextField
          label={t("common.quantity")}
          min="0"
          onChange={(event) => setQuantity(event.target.value)}
          step="any"
          type="number"
          value={quantity}
        />
        <TextField
          label={t("common.unit")}
          onChange={(event) => setUnit(event.target.value)}
          placeholder={t("pantry.unitPlaceholder")}
          value={unit}
        />
        <TextField
          fieldClassName="sm:col-span-2"
          hint={t("pantry.expirationHint")}
          label={t("pantry.expirationLabel")}
          onChange={(event) => setExpirationDate(event.target.value)}
          type="date"
          value={expirationDate}
        />
        <TextField
          fieldClassName="sm:col-span-6"
          label={t("pantry.notesLabel")}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t("pantry.notesPlaceholder")}
          value={notes}
        />
      </div>

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
