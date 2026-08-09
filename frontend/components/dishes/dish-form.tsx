"use client";

import { FormEvent, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "../../lib/i18n/client";
import Button from "../ui/Button";
import { SelectField, TextAreaField, TextField } from "../ui/Field";
import type { DishCategory } from "./dish-categories-manager";

export type DishIngredientInput = {
  name: string;
  quantity: number;
  unit: string | null;
};

export type DishFormValues = {
  name: string;
  notes: string | null;
  categoryId: number | null;
  ingredients: DishIngredientInput[];
};

type IngredientRow = {
  localId: string;
  name: string;
  quantity: string;
  unit: string;
};

type DishFormProps = {
  initialName?: string;
  initialNotes?: string;
  initialCategoryId?: number | null;
  initialIngredients?: DishIngredientInput[];
  categories: DishCategory[];
  isSubmitting: boolean;
  onSubmit: (values: DishFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
};

const createIngredientRow = (ingredient?: DishIngredientInput): IngredientRow => ({
  localId: crypto.randomUUID(),
  name: ingredient?.name ?? "",
  quantity: String(ingredient?.quantity ?? 1),
  unit: ingredient?.unit ?? ""
});

// A dish is written down once and then read back on every shopping trip, so the
// form always keeps one blank line ready rather than making the next ingredient
// start with a press of "Add ingredient".
const createInitialRows = (ingredients: DishIngredientInput[]) =>
  ingredients.length > 0
    ? ingredients.map((ingredient) => createIngredientRow(ingredient))
    : [createIngredientRow()];

export default function DishForm({
  initialName = "",
  initialNotes = "",
  initialCategoryId = null,
  initialIngredients = [],
  categories,
  isSubmitting,
  onSubmit,
  onCancel,
  submitLabel
}: DishFormProps) {
  const { t } = useTranslations();
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes);
  const [categoryId, setCategoryId] = useState<number | null>(initialCategoryId);
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>(() =>
    createInitialRows(initialIngredients)
  );
  const [errorMessage, setErrorMessage] = useState("");

  const updateRow = (localId: string, updates: Partial<IngredientRow>) => {
    setIngredientRows((currentRows) =>
      currentRows.map((row) => (row.localId === localId ? { ...row, ...updates } : row))
    );
  };

  const removeRow = (localId: string) => {
    setIngredientRows((currentRows) => {
      const remainingRows = currentRows.filter((row) => row.localId !== localId);
      return remainingRows.length > 0 ? remainingRows : [createIngredientRow()];
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setErrorMessage(t("dishes.nameRequired"));
      return;
    }

    setErrorMessage("");

    // Blank lines are dropped rather than rejected, so the trailing empty row
    // never stands between the user and saving.
    const ingredients = ingredientRows
      .filter((row) => row.name.trim())
      .map((row) => ({
        name: row.name.trim(),
        quantity: Number(row.quantity) || 1,
        unit: row.unit.trim() || null
      }));

    await onSubmit({
      name: trimmedName,
      notes: notes.trim() || null,
      categoryId,
      ingredients
    });

    if (!initialName) {
      setName("");
      setNotes("");
      setCategoryId(null);
      setIngredientRows([createIngredientRow()]);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          errorMessage={errorMessage}
          label={t("dishes.nameLabel")}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("dishes.namePlaceholder")}
          value={name}
        />
        <SelectField
          hint={
            categories.length === 0 ? t("dishes.categoryHintNoCategories") : undefined
          }
          label={t("dishes.categoryLabel")}
          onChange={(event) =>
            setCategoryId(event.target.value ? Number(event.target.value) : null)
          }
          value={categoryId ?? ""}
        >
          <option value="">{t("dishes.noCategory")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          fieldClassName="sm:col-span-2"
          label={t("dishes.notesLabel")}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t("dishes.notesPlaceholder")}
          rows={2}
          value={notes}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-fg">{t("dishes.ingredientsTitle")}</h3>
          <Button
            onClick={() => setIngredientRows((currentRows) => [...currentRows, createIngredientRow()])}
            size="sm"
            variant="ghost"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("dishes.addIngredient")}
          </Button>
        </div>

        <ul className="space-y-2">
          {ingredientRows.map((row) => (
            <li
              className="grid gap-2 rounded-2xl border border-border bg-surface-muted/50 p-3 sm:grid-cols-[1fr_6rem_6rem_auto] sm:items-end"
              key={row.localId}
            >
              <TextField
                aria-label={t("dishes.ingredientNameLabel")}
                onChange={(event) => updateRow(row.localId, { name: event.target.value })}
                placeholder={t("dishes.ingredientNamePlaceholder")}
                value={row.name}
              />
              <TextField
                aria-label={t("common.quantity")}
                min="0"
                onChange={(event) => updateRow(row.localId, { quantity: event.target.value })}
                step="any"
                type="number"
                value={row.quantity}
              />
              <TextField
                aria-label={t("common.unit")}
                onChange={(event) => updateRow(row.localId, { unit: event.target.value })}
                placeholder={t("dishes.ingredientUnitPlaceholder")}
                value={row.unit}
              />
              <Button
                aria-label={t("dishes.removeIngredientAriaLabel")}
                onClick={() => removeRow(row.localId)}
                size="sm"
                variant="danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sm:sr-only">{t("common.remove")}</span>
              </Button>
            </li>
          ))}
        </ul>
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
