"use client";

import { useMemo, useState } from "react";
import { ChefHat, CookingPot, Pencil, Plus, Trash2 } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import { useTranslations } from "../../lib/i18n/client";
import { localeHeader } from "../../lib/i18n/requestHeaders";
import DishCategoriesManager, { type DishCategory } from "./dish-categories-manager";
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
  categoryId: number | null;
  ingredients: DishIngredient[];
};

type DishesManagerProps = {
  initialDishes: Dish[];
  initialCategories: DishCategory[];
  /**
   * Set when the screen could not read the cookbook, so an outage is reported
   * as one instead of being drawn as an empty shelf.
   */
  hasLoadFailure: boolean;
};

/** One shelf of the cookbook as the list draws it: a heading and its dishes. */
type DishGroup = {
  key: string;
  label: string;
  dishes: Dish[];
};

const sortDishesByName = (dishes: Dish[], locale: string) =>
  [...dishes].sort((firstDish, secondDish) =>
    firstDish.name.localeCompare(secondDish.name, locale)
  );

const formatIngredient = (ingredient: DishIngredient) =>
  `${ingredient.name} · ${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ""}`;

export default function DishesManager({
  initialDishes,
  initialCategories,
  hasLoadFailure
}: DishesManagerProps) {
  const { locale, t, plural } = useTranslations();
  const [dishes, setDishes] = useState(initialDishes);
  const [categories, setCategories] = useState(initialCategories);
  const [isCreating, setIsCreating] = useState(false);
  const [editingDishId, setEditingDishId] = useState<number | null>(null);
  const [savingDishId, setSavingDishId] = useState<number | null>(null);
  const [dishPendingDeletion, setDishPendingDeletion] = useState<Dish | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [feedback, setFeedback] = useState("");

  const sortDishes = (nextDishes: Dish[]) => sortDishesByName(nextDishes, locale);

  // The counts on the category rows are worked out from the dishes on screen
  // rather than taken from the server's copy, so moving a dish between shelves
  // corrects both badges without a refetch.
  const categoriesWithCounts = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        dishCount: dishes.filter((dish) => dish.categoryId === category.id).length
      })),
    [categories, dishes]
  );

  // Dishes are read a shelf at a time: categories in alphabetical order, the
  // dishes inside each one alphabetical too, and whatever has not been given a
  // category last rather than first, since it is the leftovers pile.
  const dishGroups = useMemo<DishGroup[]>(() => {
    const sortedDishes = sortDishesByName(dishes, locale);
    const categorisedGroups = categories
      .map((category) => ({
        key: `category-${category.id}`,
        label: category.name,
        dishes: sortedDishes.filter((dish) => dish.categoryId === category.id)
      }))
      .filter((group) => group.dishes.length > 0);

    const uncategorisedDishes = sortedDishes.filter((dish) => {
      if (dish.categoryId === null) {
        return true;
      }

      // A dish whose category was deleted in another tab would otherwise vanish
      // from the list entirely, so anything pointing at a category we do not
      // have falls back to the uncategorised shelf.
      return !categories.some((category) => category.id === dish.categoryId);
    });

    if (uncategorisedDishes.length === 0) {
      return categorisedGroups;
    }

    return [
      ...categorisedGroups,
      {
        key: "uncategorised",
        // Left unlabelled while nothing else is categorised: a lone "Without a
        // category" heading over the whole cookbook names a distinction that is
        // not being drawn yet.
        label: categorisedGroups.length > 0 ? t("dishes.uncategorised") : "",
        dishes: uncategorisedDishes
      }
    ];
  }, [categories, dishes, locale, t]);

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
          categories={categoriesWithCounts}
          isSubmitting={isCreating}
          onSubmit={createDish}
          submitLabel={t("dishes.addSubmit")}
        />
      </SectionCard>

      <DishCategoriesManager
        categories={categoriesWithCounts}
        onCategoriesChange={setCategories}
        onCategoryDeleted={(categoryId) =>
          setDishes((currentDishes) =>
            currentDishes.map((dish) =>
              dish.categoryId === categoryId ? { ...dish, categoryId: null } : dish
            )
          )
        }
      />

      {hasLoadFailure ? <Alert tone="error">{t("dishes.loadFailed")}</Alert> : null}
      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
      {feedback ? <Alert tone="success">{feedback}</Alert> : null}

      {dishes.length === 0 && !hasLoadFailure ? (
        <EmptyState
          description={t("dishes.emptyDescription")}
          icon={<CookingPot className="h-5 w-5" />}
          title={t("dishes.emptyTitle")}
        />
      ) : (
        <div className="space-y-6">
          {dishGroups.map((group) => (
            <section className="space-y-3" key={group.key}>
              {group.label ? (
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                  {group.label}
                  <span className="text-fg-subtle/70">
                    {plural("dishes.dishCount", group.dishes.length)}
                  </span>
                </h2>
              ) : null}

              <ul className="space-y-3">
                {group.dishes.map((dish) => (
            <li key={dish.id}>
              <Card>
                {editingDishId === dish.id ? (
                  <DishForm
                    categories={categoriesWithCounts}
                    initialCategoryId={dish.categoryId}
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
            </section>
          ))}
        </div>
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
