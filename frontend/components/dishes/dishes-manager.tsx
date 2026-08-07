"use client";

import { useState } from "react";
import { ChefHat, CookingPot, Pencil, Plus, Trash2 } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import { useTranslations } from "../../lib/i18n/client";
import { localeHeader } from "../../lib/i18n/requestHeaders";
import DishForm, { type DishFormValues } from "./dish-form";
import Alert from "../ui/Alert";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card, { SectionCard } from "../ui/Card";
import ConfirmModal from "../ui/ConfirmModal";
import EmptyState from "../ui/EmptyState";

export type DishIngredient = {
  id: number;
  name: string;
  quantity: number;
  unit: string | null;
};

export type Dish = {
  id: number;
  name: string;
  notes: string | null;
  ingredients: DishIngredient[];
};

type DishesManagerProps = {
  initialDishes: Dish[];
};

const formatIngredient = (ingredient: DishIngredient) =>
  `${ingredient.name} · ${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ""}`;

export default function DishesManager({ initialDishes }: DishesManagerProps) {
  const { locale, t, plural } = useTranslations();
  const [dishes, setDishes] = useState(initialDishes);
  const [isCreating, setIsCreating] = useState(false);
  const [editingDishId, setEditingDishId] = useState<number | null>(null);
  const [savingDishId, setSavingDishId] = useState<number | null>(null);
  const [dishPendingDeletion, setDishPendingDeletion] = useState<Dish | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [feedback, setFeedback] = useState("");

  const sortDishes = (nextDishes: Dish[]) =>
    [...nextDishes].sort((firstDish, secondDish) =>
      firstDish.name.localeCompare(secondDish.name, locale)
    );

  const createDish = async (values: DishFormValues) => {
    setIsCreating(true);
    setErrorMessage("");
    setFeedback("");

    try {
      const response = await fetch(`${backendApiUrl}/api/dishes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify(values)
      });

      if (response.status === 409) {
        setErrorMessage(t("dishes.nameTaken"));
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to create dish.");
      }

      const data = (await response.json()) as { dish: Dish };
      setDishes((currentDishes) => sortDishes([...currentDishes, data.dish]));
      setFeedback(t("dishes.created", { name: data.dish.name }));
    } catch (_error) {
      setErrorMessage(t("dishes.createFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  const updateDish = async (dishId: number, values: DishFormValues) => {
    setSavingDishId(dishId);
    setErrorMessage("");
    setFeedback("");

    try {
      const response = await fetch(`${backendApiUrl}/api/dishes/${dishId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify(values)
      });

      if (response.status === 409) {
        setErrorMessage(t("dishes.nameTaken"));
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to update dish.");
      }

      const data = (await response.json()) as { dish: Dish };
      setDishes((currentDishes) =>
        sortDishes(
          currentDishes.map((dish) => (dish.id === dishId ? data.dish : dish))
        )
      );
      setEditingDishId(null);
      setFeedback(t("dishes.updated", { name: data.dish.name }));
    } catch (_error) {
      setErrorMessage(t("dishes.updateFailed"));
    } finally {
      setSavingDishId(null);
    }
  };

  const deleteDish = async (dish: Dish) => {
    setSavingDishId(dish.id);
    setErrorMessage("");
    setFeedback("");

    try {
      const response = await fetch(`${backendApiUrl}/api/dishes/${dish.id}`, {
        method: "DELETE",
        headers: localeHeader(locale),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Unable to delete dish.");
      }

      setDishes((currentDishes) =>
        currentDishes.filter((currentDish) => currentDish.id !== dish.id)
      );
      setFeedback(t("dishes.deleted", { name: dish.name }));
    } catch (_error) {
      setErrorMessage(t("dishes.deleteFailed"));
    } finally {
      setSavingDishId(null);
      setDishPendingDeletion(null);
    }
  };

  return (
    <section className="space-y-5">
      <SectionCard
        description={t("dishes.addDescription")}
        icon={<Plus className="h-4 w-4" />}
        title={t("dishes.addTitle")}
      >
        <DishForm
          isSubmitting={isCreating}
          onSubmit={createDish}
          submitLabel={t("dishes.addSubmit")}
        />
      </SectionCard>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
      {feedback ? <Alert tone="success">{feedback}</Alert> : null}

      {dishes.length === 0 ? (
        <EmptyState
          description={t("dishes.emptyDescription")}
          icon={<CookingPot className="h-5 w-5" />}
          title={t("dishes.emptyTitle")}
        />
      ) : (
        <ul className="space-y-3">
          {dishes.map((dish) => (
            <li key={dish.id}>
              <Card>
                {editingDishId === dish.id ? (
                  <DishForm
                    initialIngredients={dish.ingredients}
                    initialName={dish.name}
                    initialNotes={dish.notes ?? ""}
                    isSubmitting={savingDishId === dish.id}
                    onCancel={() => setEditingDishId(null)}
                    onSubmit={(values) => updateDish(dish.id, values)}
                    submitLabel={t("common.save")}
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                          <ChefHat className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-fg">{dish.name}</p>
                          <Badge tone={dish.ingredients.length > 0 ? "accent" : "neutral"}>
                            {plural("dishes.ingredientCount", dish.ingredients.length)}
                          </Badge>
                          {dish.notes ? (
                            <p className="mt-2 max-w-prose text-sm text-fg-muted">{dish.notes}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          disabled={savingDishId === dish.id}
                          onClick={() => setEditingDishId(dish.id)}
                          size="sm"
                          variant="secondary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t("common.edit")}
                        </Button>
                        <Button
                          disabled={savingDishId === dish.id}
                          onClick={() => setDishPendingDeletion(dish)}
                          size="sm"
                          variant="danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("common.delete")}
                        </Button>
                      </div>
                    </div>

                    {dish.ingredients.length > 0 ? (
                      <ul className="flex flex-wrap gap-2">
                        {dish.ingredients.map((ingredient) => (
                          <li
                            className="rounded-full bg-surface-muted px-3 py-1 text-sm text-fg-muted"
                            key={ingredient.id}
                          >
                            {formatIngredient(ingredient)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-fg-subtle">{t("dishes.noIngredients")}</p>
                    )}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("dishes.deleteConfirm")}
        confirmVariant="danger"
        description={t("dishes.deleteDescription")}
        isLoading={savingDishId === dishPendingDeletion?.id}
        isOpen={Boolean(dishPendingDeletion)}
        onCancel={() => setDishPendingDeletion(null)}
        onConfirm={() => {
          if (dishPendingDeletion) {
            void deleteDish(dishPendingDeletion);
          }
        }}
        title={t("dishes.deleteTitle", { name: dishPendingDeletion?.name ?? "" })}
      />
    </section>
  );
}
