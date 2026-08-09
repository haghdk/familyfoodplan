"use client";

import { FormEvent, useState } from "react";
import { FolderPlus, Pencil, Tags, Trash2 } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import { useTranslations } from "../../lib/i18n/client";
import { localeHeader } from "../../lib/i18n/requestHeaders";
import Alert from "../ui/Alert";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { SectionCard } from "../ui/Card";
import ConfirmModal from "../ui/ConfirmModal";
import { TextField } from "../ui/Field";

export type DishCategory = {
  id: number;
  name: string;
  /** How many dishes sit on this shelf, so a delete can say what it affects. */
  dishCount: number;
};

type DishCategoriesManagerProps = {
  categories: DishCategory[];
  /**
   * Handed the whole next list rather than a single change, because the dish
   * list above is grouped by these categories and has to be redrawn with them.
   */
  onCategoriesChange: (categories: DishCategory[]) => void;
  /** Called after a delete, since the dishes on that shelf become uncategorised. */
  onCategoryDeleted: (categoryId: number) => void;
};

/**
 * The shelves of the cookbook. Kept beside the dish list rather than on a screen
 * of its own: a category is only ever named because a dish needs it, and naming
 * one two clicks away from the dish would be the slower path.
 */
export default function DishCategoriesManager({
  categories,
  onCategoriesChange,
  onCategoryDeleted
}: DishCategoriesManagerProps) {
  const { locale, t } = useTranslations();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingCategoryId, setSavingCategoryId] = useState<number | null>(null);
  const [categoryPendingDeletion, setCategoryPendingDeletion] =
    useState<DishCategory | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const sortCategories = (nextCategories: DishCategory[]) =>
    [...nextCategories].sort((firstCategory, secondCategory) =>
      firstCategory.name.localeCompare(secondCategory.name, locale)
    );

  const createCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newCategoryName.trim();

    if (!trimmedName) {
      setErrorMessage(t("dishCategories.nameRequired"));
      return;
    }

    setIsCreating(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${backendApiUrl}/api/dish-categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify({ name: trimmedName })
      });

      if (response.status === 409) {
        setErrorMessage(t("dishCategories.nameTaken"));
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to create dish category.");
      }

      const data = (await response.json()) as { dishCategory: DishCategory };
      onCategoriesChange(sortCategories([...categories, data.dishCategory]));
      setNewCategoryName("");
    } catch (_error) {
      setErrorMessage(t("dishCategories.createFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  const updateCategory = async (categoryId: number) => {
    const trimmedName = editingName.trim();

    if (!trimmedName) {
      setErrorMessage(t("dishCategories.nameRequired"));
      return;
    }

    setSavingCategoryId(categoryId);
    setErrorMessage("");

    try {
      const response = await fetch(`${backendApiUrl}/api/dish-categories/${categoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify({ name: trimmedName })
      });

      if (response.status === 409) {
        setErrorMessage(t("dishCategories.nameTaken"));
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to update dish category.");
      }

      const data = (await response.json()) as { dishCategory: DishCategory };
      onCategoriesChange(
        sortCategories(
          categories.map((category) =>
            category.id === categoryId ? data.dishCategory : category
          )
        )
      );
      setEditingCategoryId(null);
    } catch (_error) {
      setErrorMessage(t("dishCategories.updateFailed"));
    } finally {
      setSavingCategoryId(null);
    }
  };

  const deleteCategory = async (category: DishCategory) => {
    setSavingCategoryId(category.id);
    setErrorMessage("");

    try {
      const response = await fetch(`${backendApiUrl}/api/dish-categories/${category.id}`, {
        method: "DELETE",
        headers: localeHeader(locale),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Unable to delete dish category.");
      }

      onCategoriesChange(
        categories.filter((currentCategory) => currentCategory.id !== category.id)
      );
      onCategoryDeleted(category.id);
    } catch (_error) {
      setErrorMessage(t("dishCategories.deleteFailed"));
    } finally {
      setSavingCategoryId(null);
      setCategoryPendingDeletion(null);
    }
  };

  return (
    <SectionCard
      description={t("dishCategories.description")}
      icon={<Tags className="h-4 w-4" />}
      title={t("dishCategories.title")}
    >
      <div className="space-y-4">
        <form className="flex flex-wrap items-end gap-2" onSubmit={createCategory}>
          <TextField
            aria-label={t("dishCategories.nameLabel")}
            fieldClassName="min-w-48 flex-1"
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder={t("dishCategories.namePlaceholder")}
            value={newCategoryName}
          />
          <Button disabled={isCreating} type="submit">
            <FolderPlus className="h-4 w-4" />
            {isCreating ? t("common.saving") : t("dishCategories.addSubmit")}
          </Button>
        </form>

        {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

        {categories.length === 0 ? (
          <p className="text-sm text-fg-subtle">{t("dishCategories.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {categories.map((category) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface-muted/50 px-3 py-2"
                key={category.id}
              >
                {editingCategoryId === category.id ? (
                  <>
                    <TextField
                      aria-label={t("dishCategories.nameLabel")}
                      fieldClassName="min-w-48 flex-1"
                      onChange={(event) => setEditingName(event.target.value)}
                      value={editingName}
                    />
                    <div className="flex gap-2">
                      <Button
                        disabled={savingCategoryId === category.id}
                        onClick={() => updateCategory(category.id)}
                        size="sm"
                      >
                        {savingCategoryId === category.id
                          ? t("common.saving")
                          : t("common.save")}
                      </Button>
                      <Button
                        onClick={() => setEditingCategoryId(null)}
                        size="sm"
                        variant="secondary"
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-fg">{category.name}</span>
                      <Badge tone={category.dishCount > 0 ? "accent" : "neutral"}>
                        {t("dishCategories.dishCount", { count: category.dishCount })}
                      </Badge>
                    </span>
                    <div className="flex gap-2">
                      <Button
                        disabled={savingCategoryId === category.id}
                        onClick={() => {
                          setEditingCategoryId(category.id);
                          setEditingName(category.name);
                          setErrorMessage("");
                        }}
                        size="sm"
                        variant="secondary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t("common.edit")}
                      </Button>
                      <Button
                        disabled={savingCategoryId === category.id}
                        onClick={() => setCategoryPendingDeletion(category)}
                        size="sm"
                        variant="danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("common.delete")}
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("dishCategories.deleteConfirm")}
        confirmVariant="danger"
        description={t("dishCategories.deleteDescription")}
        isLoading={savingCategoryId === categoryPendingDeletion?.id}
        isOpen={Boolean(categoryPendingDeletion)}
        onCancel={() => setCategoryPendingDeletion(null)}
        onConfirm={() => {
          if (categoryPendingDeletion) {
            void deleteCategory(categoryPendingDeletion);
          }
        }}
        title={t("dishCategories.deleteTitle", {
          name: categoryPendingDeletion?.name ?? ""
        })}
      />
    </SectionCard>
  );
}
