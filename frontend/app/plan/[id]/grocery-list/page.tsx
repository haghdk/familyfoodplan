"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Carrot,
  Check,
  Copy,
  ExternalLink,
  GripVertical,
  Link2,
  ListChecks,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBasket,
  Trash2
} from "lucide-react";
import { backendApiUrl } from "../../../../lib/auth";
import { cn } from "../../../../lib/cn";
import { createDateFormatter } from "../../../../lib/dates";
import { useTranslations } from "../../../../lib/i18n/client";
import type { AppTranslator } from "../../../../lib/i18n/dictionaries";
import { localeHeader } from "../../../../lib/i18n/requestHeaders";
import { sortItemsByIdOrder, sortPickedUpItemsLast } from "../../../../lib/grocery";
import { useReorderAnimation } from "../../../../lib/useReorderAnimation";
import Alert from "../../../../components/ui/Alert";
import Badge from "../../../../components/ui/Badge";
import Button, { buttonClassName } from "../../../../components/ui/Button";
import { SectionCard } from "../../../../components/ui/Card";
import EmptyState from "../../../../components/ui/EmptyState";
import { SelectField, TextField, controlClassName } from "../../../../components/ui/Field";
import PageHeader from "../../../../components/ui/PageHeader";
import SortableList from "../../../../components/ui/SortableList";

type MealRef = {
  id: number;
  name: string;
};

type PlanDayPayload = {
  id: number;
  date: string;
  dinnerDish: MealRef | null;
  breakfastDishes: MealRef[];
  lunchDishes: MealRef[];
};

type MealOption = {
  id: string;
  label: string;
};

type GroceryItem = {
  id: number;
  name: string;
  quantity: number;
  unit: string | null;
  category: "GENERAL" | "INGREDIENT";
  isChecked: boolean;
  dinnerDish: MealRef | null;
  breakfastDish: MealRef | null;
  lunchDish: MealRef | null;
};

type MergedGroceryItem = {
  key: string;
  name: string;
  quantity: number;
  unit: string | null;
  category: "GENERAL" | "INGREDIENT";
  sourceLabels: string[];
  itemIds: number[];
};

type GroceryResponse = {
  planDays: PlanDayPayload[];
  groceryItems: GroceryItem[];
  mergedItems: MergedGroceryItem[];
};

type EditableRow = {
  id: number;
  name: string;
  quantity: string;
  unit: string;
};

type GroceryRealtimeEvent = {
  eventType:
    | "grocery_item_created"
    | "grocery_item_updated"
    | "grocery_item_deleted"
    | "grocery_items_reordered";
  planId: number;
  token: string | null;
  item: GroceryItem | null;
  deletedItemId: number | null;
  orderedItemIds: number[] | null;
};

const formatQuantity = (quantity: number, unit: string | null) =>
  `${quantity}${unit ? ` ${unit}` : ""}`;

const describeItemSource = (item: GroceryItem, { t }: AppTranslator) => {
  if (item.dinnerDish) {
    return t("grocery.sourceMeal", {
      meal: t("meals.dinner"),
      dish: item.dinnerDish.name
    });
  }

  if (item.breakfastDish) {
    return t("grocery.sourceMeal", {
      meal: t("meals.breakfast"),
      dish: item.breakfastDish.name
    });
  }

  if (item.lunchDish) {
    return t("grocery.sourceMeal", {
      meal: t("meals.lunch"),
      dish: item.lunchDish.name
    });
  }

  return t("grocery.sourceGeneralItem");
};

export default function GroceryListPage() {
  const params = useParams<{ id: string }>();
  const planId = Number(params.id);
  const translator = useTranslations();
  const { locale, t, plural } = translator;
  const [planDays, setPlanDays] = useState<PlanDayPayload[]>([]);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [mergedItems, setMergedItems] = useState<MergedGroceryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [feedback, setFeedback] = useState("");

  const [shareLink, setShareLink] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");

  const [generalName, setGeneralName] = useState("");
  const [generalQuantity, setGeneralQuantity] = useState("1");
  const [generalUnit, setGeneralUnit] = useState("");

  const [ingredientName, setIngredientName] = useState("");
  const [ingredientQuantity, setIngredientQuantity] = useState("1");
  const [ingredientUnit, setIngredientUnit] = useState("");
  const [selectedMealType, setSelectedMealType] = useState<"dinner" | "breakfast" | "lunch">("dinner");
  const [selectedMealId, setSelectedMealId] = useState("");

  const [editingRows, setEditingRows] = useState<Record<number, EditableRow>>({});

  // The detailed list mirrors what the shoppers see, so items they picked up
  // sink to the bottom here too. It is display only — `groceryItems` keeps the
  // stored shopping order, which is what the merged list above writes.
  const visibleGroceryItems = useMemo(() => sortPickedUpItemsLast(groceryItems), [groceryItems]);
  const visibleGroceryItemIds = useMemo(
    () => visibleGroceryItems.map((item) => item.id),
    [visibleGroceryItems]
  );
  const { containerRef, registerRow } = useReorderAnimation(visibleGroceryItemIds);

  const loadItems = useCallback(
    async ({ showLoadingState = true }: { showLoadingState?: boolean } = {}) => {
      if (showLoadingState) {
        setIsLoading(true);
      }

      setErrorMessage("");

      try {
        const response = await fetch(`${backendApiUrl}/api/plans/${planId}/grocery-items`, {
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error("Unable to load grocery list.");
        }

        const data = (await response.json()) as GroceryResponse;
        setPlanDays(data.planDays);
        setGroceryItems(data.groceryItems);
        setMergedItems(data.mergedItems);
      } catch (_error) {
        setErrorMessage(t("grocery.loadFailed"));
      } finally {
        setIsLoading(false);
      }
    },
    [planId, t]
  );

  useEffect(() => {
    if (Number.isNaN(planId)) {
      setErrorMessage(t("grocery.invalidPlanId"));
      setIsLoading(false);
      return;
    }

    void loadItems();
  }, [loadItems, planId, t]);

  useEffect(() => {
    if (Number.isNaN(planId)) {
      return;
    }

    let isMounted = true;
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let hasConnectedBefore = false;

    const handleRealtimeEvent = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as GroceryRealtimeEvent;

      setGroceryItems((currentItems) => {
        if (payload.eventType === "grocery_items_reordered" && payload.orderedItemIds) {
          return sortItemsByIdOrder(currentItems, payload.orderedItemIds);
        }

        if (payload.eventType === "grocery_item_deleted" && payload.deletedItemId) {
          return currentItems.filter((item) => item.id !== payload.deletedItemId);
        }

        if (!payload.item) {
          return currentItems;
        }

        const existingItem = currentItems.find((item) => item.id === payload.item?.id);

        if (!existingItem) {
          return [...currentItems, payload.item];
        }

        return currentItems.map((item) => (item.id === payload.item?.id ? payload.item : item));
      });

      void loadItems({ showLoadingState: false });
    };

    const connect = () => {
      eventSource = new EventSource(
        `${backendApiUrl}/api/realtime/grocery/admin?planId=${planId}`,
        { withCredentials: true }
      );

      eventSource.onopen = () => {
        if (!isMounted) {
          return;
        }

        setIsRealtimeConnected(true);
        reconnectAttempts = 0;

        if (hasConnectedBefore) {
          void loadItems({ showLoadingState: false });
        }

        hasConnectedBefore = true;
      };

      eventSource.addEventListener("grocery_item_created", handleRealtimeEvent);
      eventSource.addEventListener("grocery_item_updated", handleRealtimeEvent);
      eventSource.addEventListener("grocery_item_deleted", handleRealtimeEvent);
      eventSource.addEventListener("grocery_items_reordered", handleRealtimeEvent);

      eventSource.onerror = () => {
        if (!isMounted) {
          return;
        }

        setIsRealtimeConnected(false);

        // The browser retries a dropped stream on its own, but a closed one —
        // refused by a proxy, or answered with an error status — needs a new
        // EventSource or the page silently stops receiving updates.
        if (eventSource?.readyState !== EventSource.CLOSED) {
          return;
        }

        eventSource.close();
        reconnectTimeout = setTimeout(connect, Math.min(30000, 2 ** reconnectAttempts * 1000));
        reconnectAttempts += 1;
      };
    };

    connect();

    return () => {
      isMounted = false;

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      eventSource?.close();
    };
  }, [loadItems, planId]);

  // Keeps the list moving when the live stream cannot be established at all,
  // so an admin editing the list still sees what the shoppers tick off.
  useEffect(() => {
    if (isRealtimeConnected || Number.isNaN(planId)) {
      return;
    }

    const pollInterval = setInterval(() => {
      void loadItems({ showLoadingState: false });
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [isRealtimeConnected, loadItems, planId]);

  const mealOptions = useMemo(() => {
    const { formatCompactDayLabel } = createDateFormatter(translator);

    const dinnerOptions: MealOption[] = planDays.flatMap((day) =>
      day.dinnerDish
        ? [
            {
              id: String(day.dinnerDish.id),
              label: t("grocery.mealOption", {
                day: formatCompactDayLabel(day.date),
                meal: t("meals.dinner"),
                dish: day.dinnerDish.name
              })
            }
          ]
        : []
    );

    const breakfastOptions: MealOption[] = planDays.flatMap((day) =>
      day.breakfastDishes.map((breakfastDish) => ({
        id: String(breakfastDish.id),
        label: t("grocery.mealOption", {
          day: formatCompactDayLabel(day.date),
          meal: t("meals.breakfast"),
          dish: breakfastDish.name
        })
      }))
    );

    const lunchOptions: MealOption[] = planDays.flatMap((day) =>
      day.lunchDishes.map((lunchDish) => ({
        id: String(lunchDish.id),
        label: t("grocery.mealOption", {
          day: formatCompactDayLabel(day.date),
          meal: t("meals.lunch"),
          dish: lunchDish.name
        })
      }))
    );

    if (selectedMealType === "dinner") {
      return dinnerOptions;
    }

    return selectedMealType === "breakfast" ? breakfastOptions : lunchOptions;
  }, [planDays, selectedMealType, t, translator]);

  const mealAvailability = useMemo(() => {
    const hasDinner = planDays.some((day) => Boolean(day.dinnerDish));
    const hasBreakfast = planDays.some((day) => day.breakfastDishes.length > 0);
    const hasLunch = planDays.some((day) => day.lunchDishes.length > 0);

    return {
      hasDinner,
      hasBreakfast,
      hasLunch,
      hasAnyMeals: hasDinner || hasBreakfast || hasLunch
    };
  }, [planDays]);

  useEffect(() => {
    if (!mealAvailability.hasAnyMeals) {
      return;
    }

    if (selectedMealType === "dinner" && !mealAvailability.hasDinner) {
      if (mealAvailability.hasBreakfast) {
        setSelectedMealType("breakfast");
      } else if (mealAvailability.hasLunch) {
        setSelectedMealType("lunch");
      }
      return;
    }

    if (selectedMealType === "breakfast" && !mealAvailability.hasBreakfast) {
      if (mealAvailability.hasDinner) {
        setSelectedMealType("dinner");
      } else if (mealAvailability.hasLunch) {
        setSelectedMealType("lunch");
      }
      return;
    }

    if (selectedMealType === "lunch" && !mealAvailability.hasLunch) {
      if (mealAvailability.hasDinner) {
        setSelectedMealType("dinner");
      } else if (mealAvailability.hasBreakfast) {
        setSelectedMealType("breakfast");
      }
    }
  }, [mealAvailability, selectedMealType]);

  useEffect(() => {
    setSelectedMealId(mealOptions[0]?.id ?? "");
  }, [mealOptions]);

  const toShareUrl = useCallback((token: string) => `${window.location.origin}/grocery/${token}`, []);

  const loadShareLink = useCallback(
    async ({ showSuccessFeedback = false }: { showSuccessFeedback?: boolean } = {}) => {
      const response = await fetch(`${backendApiUrl}/api/plans/${planId}/share-link`, {
        method: "POST",
        headers: localeHeader(locale),
        credentials: "include"
      });

      if (!response.ok) {
        setShareFeedback(t("grocery.share.loadFailed"));
        return;
      }

      const data = (await response.json()) as { token: string; existed: boolean };
      const nextShareLink = toShareUrl(data.token);
      setShareLink(nextShareLink);

      if (!showSuccessFeedback) {
        return;
      }

      setShareFeedback(
        data.existed ? t("grocery.share.existingLoaded") : t("grocery.share.ready")
      );
    },
    [locale, planId, t, toShareUrl]
  );

  useEffect(() => {
    if (Number.isNaN(planId)) {
      return;
    }

    void loadShareLink();
  }, [loadShareLink, planId]);

  const createShareLink = async () => {
    await loadShareLink({ showSuccessFeedback: true });
  };

  const rotateShareLink = async () => {
    const response = await fetch(`${backendApiUrl}/api/plans/${planId}/share-link/rotate`, {
      method: "POST",
      headers: localeHeader(locale),
      credentials: "include"
    });

    if (!response.ok) {
      setShareFeedback(t("grocery.share.rotateFailed"));
      return;
    }

    const data = (await response.json()) as { token: string };
    const nextShareLink = toShareUrl(data.token);
    setShareLink(nextShareLink);
    setShareFeedback(t("grocery.share.rotated"));
  };

  const copyShareLink = async () => {
    if (!shareLink) {
      setShareFeedback(t("grocery.share.createFirst"));
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      setShareFeedback(t("grocery.share.copied"));
    } catch (_error) {
      setShareFeedback(t("grocery.share.copyFailed"));
    }
  };

  const createGeneralItem = async () => {
    const name = generalName.trim();

    if (!name) {
      setFeedback(t("grocery.general.nameRequired"));
      return;
    }

    const response = await fetch(`${backendApiUrl}/api/plans/${planId}/grocery-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...localeHeader(locale) },
      credentials: "include",
      body: JSON.stringify({
        name,
        quantity: Number(generalQuantity) || 1,
        unit: generalUnit.trim() || null,
        category: "GENERAL"
      })
    });

    if (!response.ok) {
      setFeedback(t("grocery.general.createFailed"));
      return;
    }

    setGeneralName("");
    setGeneralQuantity("1");
    setGeneralUnit("");
    setFeedback(t("grocery.general.added"));
    await loadItems();
  };

  const createIngredientItem = async () => {
    const name = ingredientName.trim();

    if (!name || !selectedMealId) {
      setFeedback(t("grocery.ingredient.required"));
      return;
    }

    const payload = {
      name,
      quantity: Number(ingredientQuantity) || 1,
      unit: ingredientUnit.trim() || null,
      category: "INGREDIENT",
      dinnerDishId: selectedMealType === "dinner" ? Number(selectedMealId) : null,
      breakfastDishId: selectedMealType === "breakfast" ? Number(selectedMealId) : null,
      lunchDishId: selectedMealType === "lunch" ? Number(selectedMealId) : null
    };

    const response = await fetch(`${backendApiUrl}/api/plans/${planId}/grocery-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...localeHeader(locale) },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setFeedback(t("grocery.ingredient.createFailed"));
      return;
    }

    setIngredientName("");
    setIngredientQuantity("1");
    setIngredientUnit("");
    setFeedback(t("grocery.ingredient.added"));
    await loadItems();
  };

  // Persists the manual shopping order after a drag. The merged lines are the
  // unit the user drags, so every underlying item of a line moves with it.
  const reorderMergedItems = useCallback(
    async (reorderedItems: MergedGroceryItem[]) => {
      const previousMergedItems = mergedItems;
      const orderedItemIds = reorderedItems.flatMap((mergedItem) => mergedItem.itemIds);

      setMergedItems(reorderedItems);
      setGroceryItems((currentItems) => sortItemsByIdOrder(currentItems, orderedItemIds));
      setFeedback("");

      const response = await fetch(`${backendApiUrl}/api/plans/${planId}/grocery-items/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify({ itemIds: orderedItemIds })
      });

      if (!response.ok) {
        setMergedItems(previousMergedItems);
        setFeedback("");
        setErrorMessage(t("grocery.merged.orderFailed"));
        await loadItems({ showLoadingState: false });
        return;
      }

      setErrorMessage("");
      setFeedback(t("grocery.merged.orderSaved"));
    },
    [loadItems, locale, mergedItems, planId, t]
  );

  const startEditing = (item: GroceryItem) => {
    setEditingRows((currentRows) => ({
      ...currentRows,
      [item.id]: {
        id: item.id,
        name: item.name,
        quantity: String(item.quantity),
        unit: item.unit ?? ""
      }
    }));
  };

  const cancelEditing = (itemId: number) => {
    setEditingRows((currentRows) => {
      const nextRows = { ...currentRows };
      delete nextRows[itemId];
      return nextRows;
    });
  };

  const saveItem = async (itemId: number) => {
    const row = editingRows[itemId];

    if (!row || !row.name.trim()) {
      setFeedback(t("grocery.items.nameRequired"));
      return;
    }

    const response = await fetch(`${backendApiUrl}/api/plans/${planId}/grocery-items/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...localeHeader(locale) },
      credentials: "include",
      body: JSON.stringify({
        name: row.name.trim(),
        quantity: Number(row.quantity) || 1,
        unit: row.unit.trim() || null
      })
    });

    if (!response.ok) {
      setFeedback(t("grocery.items.updateFailed"));
      return;
    }

    setFeedback(t("grocery.items.updated"));
    cancelEditing(itemId);
    await loadItems();
  };

  const removeItem = async (itemId: number) => {
    const response = await fetch(`${backendApiUrl}/api/plans/${planId}/grocery-items/${itemId}`, {
      method: "DELETE",
      headers: localeHeader(locale),
      credentials: "include"
    });

    if (!response.ok) {
      setFeedback(t("grocery.items.removeFailed"));
      return;
    }

    setFeedback(t("grocery.items.removed"));
    await loadItems();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-56 animate-pulse rounded-full bg-surface-muted" />
        <div className="h-40 animate-pulse rounded-3xl bg-surface-muted" />
        <div className="h-64 animate-pulse rounded-3xl bg-surface-muted" />
        <span className="sr-only">{t("grocery.loading")}</span>
      </div>
    );
  }

  const checkedItemsCount = groceryItems.filter((item) => item.isChecked).length;

  return (
    <section className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition hover:text-brand"
          href={`/plan/${params.id}`}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("grocery.backToPlan")}
        </Link>
      </div>

      <PageHeader
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isRealtimeConnected ? "bg-success" : "bg-warning"
              )}
            />
            {isRealtimeConnected
              ? t("grocery.liveUpdatesOn")
              : t("grocery.reconnecting")}
          </span>
        }
        description={t("grocery.description")}
        eyebrow={t("grocery.eyebrow")}
        eyebrowIcon={<ShoppingBasket className="h-3.5 w-3.5" />}
        title={t("grocery.title", { planId: params.id })}
      />

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
      {feedback ? <Alert tone="success">{feedback}</Alert> : null}

      <SectionCard
        description={t("grocery.share.description")}
        icon={<Link2 className="h-4 w-4" />}
        title={t("grocery.share.title")}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            aria-label={t("grocery.share.linkAriaLabel")}
            className={cn(controlClassName, "font-mono text-xs sm:text-sm")}
            placeholder={t("grocery.share.noLinkYet")}
            readOnly
            value={shareLink}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={copyShareLink}>
              <Copy className="h-4 w-4" />
              {t("common.copy")}
            </Button>
            {shareLink ? (
              <a
                className={buttonClassName({ variant: "secondary" })}
                href={shareLink}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-4 w-4" />
                {t("common.open")}
              </a>
            ) : (
              <Button
                disabled
                title={t("grocery.share.createFirst")}
                variant="secondary"
              >
                <ExternalLink className="h-4 w-4" />
                {t("common.open")}
              </Button>
            )}
            <Button onClick={createShareLink} variant="secondary">
              <Link2 className="h-4 w-4" />
              {t("grocery.share.loadOrCreate")}
            </Button>
            <Button onClick={rotateShareLink} variant="secondary">
              <RefreshCw className="h-4 w-4" />
              {t("grocery.share.rotate")}
            </Button>
          </div>
        </div>
        {shareFeedback ? (
          <p className="mt-3 text-sm text-fg-muted">{shareFeedback}</p>
        ) : null}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          description={t("grocery.general.description")}
          icon={<Package className="h-4 w-4" />}
          title={t("grocery.general.title")}
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <TextField
              fieldClassName="sm:col-span-2"
              label={t("common.name")}
              onChange={(event) => setGeneralName(event.target.value)}
              placeholder={t("grocery.general.namePlaceholder")}
              value={generalName}
            />
            <TextField
              label={t("common.quantity")}
              min="1"
              onChange={(event) => setGeneralQuantity(event.target.value)}
              step="1"
              type="number"
              value={generalQuantity}
            />
            <TextField
              label={t("common.unit")}
              onChange={(event) => setGeneralUnit(event.target.value)}
              placeholder={t("grocery.general.unitPlaceholder")}
              value={generalUnit}
            />
          </div>
          <Button className="mt-4" onClick={createGeneralItem}>
            <Plus className="h-4 w-4" />
            {t("grocery.general.submit")}
          </Button>
        </SectionCard>

        <SectionCard
          description={t("grocery.ingredient.description")}
          icon={<Carrot className="h-4 w-4" />}
          title={t("grocery.ingredient.title")}
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <SelectField
              fieldClassName="sm:col-span-2"
              label={t("grocery.ingredient.mealTypeLabel")}
              onChange={(event) =>
                setSelectedMealType(event.target.value as "dinner" | "breakfast" | "lunch")
              }
              value={selectedMealType}
            >
              <option value="dinner">{t("meals.dinner")}</option>
              <option value="breakfast">{t("meals.breakfast")}</option>
              <option value="lunch">{t("meals.lunch")}</option>
            </SelectField>
            <SelectField
              disabled={!mealAvailability.hasAnyMeals}
              fieldClassName="sm:col-span-2"
              label={t("grocery.ingredient.mealLabel")}
              onChange={(event) => setSelectedMealId(event.target.value)}
              value={selectedMealId}
            >
              <option value="">{t("grocery.ingredient.selectMeal")}</option>
              {mealOptions.map((meal) => (
                <option key={meal.id} value={meal.id}>
                  {meal.label}
                </option>
              ))}
            </SelectField>
            <TextField
              fieldClassName="sm:col-span-2"
              label={t("grocery.ingredient.nameLabel")}
              onChange={(event) => setIngredientName(event.target.value)}
              placeholder={t("grocery.ingredient.namePlaceholder")}
              value={ingredientName}
            />
            <TextField
              label={t("common.quantity")}
              min="1"
              onChange={(event) => setIngredientQuantity(event.target.value)}
              step="1"
              type="number"
              value={ingredientQuantity}
            />
            <TextField
              label={t("common.unit")}
              onChange={(event) => setIngredientUnit(event.target.value)}
              placeholder={t("grocery.ingredient.unitPlaceholder")}
              value={ingredientUnit}
            />
          </div>

          {!mealAvailability.hasAnyMeals ? (
            <Alert className="mt-3" tone="warning">
              {t("grocery.ingredient.noMealsWarning")}
            </Alert>
          ) : null}

          <Button className="mt-4" onClick={createIngredientItem}>
            <Plus className="h-4 w-4" />
            {t("grocery.ingredient.submit")}
          </Button>
        </SectionCard>
      </div>

      <SectionCard
        actions={
          mergedItems.length > 0 ? (
            <Badge tone="brand">
              {plural("grocery.merged.lines", mergedItems.length)}
            </Badge>
          ) : null
        }
        description={t("grocery.merged.description")}
        icon={<ListChecks className="h-4 w-4" />}
        title={t("grocery.merged.title")}
      >
        {mergedItems.length === 0 ? (
          <EmptyState
            description={t("grocery.merged.emptyDescription")}
            icon={<ShoppingBasket className="h-5 w-5" />}
            title={t("grocery.merged.emptyTitle")}
          />
        ) : (
          <>
            <p className="mb-3 flex items-start gap-1.5 text-xs text-fg-subtle">
              <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("grocery.merged.dragHint")}
            </p>
            <SortableList
              getItemKey={(item) => item.key}
              getItemLabel={(item) => item.name}
              items={mergedItems}
              onReorder={reorderMergedItems}
              renderItem={(item) => (
                <div className="flex flex-wrap items-center justify-between gap-3 py-3 pr-4">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{item.name}</p>
                    <p className="mt-0.5 truncate text-xs text-fg-subtle">
                      {item.sourceLabels.join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={item.category === "GENERAL" ? "neutral" : "accent"}>
                      {item.category === "GENERAL"
                        ? t("grocery.categoryGeneral")
                        : t("grocery.categoryIngredient")}
                    </Badge>
                    <span className="rounded-full bg-surface-muted px-3 py-1 text-sm font-semibold text-fg">
                      {formatQuantity(item.quantity, item.unit)}
                    </span>
                  </div>
                </div>
              )}
            />
          </>
        )}
      </SectionCard>

      <SectionCard
        actions={
          groceryItems.length > 0 ? (
            <Badge>
              {t("grocery.items.checkedOff", {
                checked: checkedItemsCount,
                total: groceryItems.length
              })}
            </Badge>
          ) : null
        }
        description={t("grocery.items.description")}
        icon={<Pencil className="h-4 w-4" />}
        title={t("grocery.items.title")}
      >
        {groceryItems.length === 0 ? (
          <EmptyState
            description={t("grocery.items.emptyDescription")}
            icon={<Package className="h-5 w-5" />}
            title={t("grocery.items.emptyTitle")}
          />
        ) : (
          <ul className="space-y-2" ref={containerRef}>
            {visibleGroceryItems.map((item) => {
              const editingRow = editingRows[item.id];

              if (!editingRow) {
                return (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-muted/40 px-4 py-3"
                    key={item.id}
                    ref={registerRow(item.id)}
                  >
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "font-medium",
                          item.isChecked ? "text-fg-subtle line-through" : "text-fg"
                        )}
                      >
                        {item.name}
                        <span className="ml-2 text-sm font-normal text-fg-muted">
                          {formatQuantity(item.quantity, item.unit)}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-fg-subtle">
                        {describeItemSource(item, translator)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.isChecked ? (
                        <Badge icon={<Check className="h-3.5 w-3.5" />} tone="brand">
                          {t("grocery.items.bought")}
                        </Badge>
                      ) : null}
                      <Button
                        aria-label={t("grocery.items.editAriaLabel", {
                          name: item.name
                        })}
                        onClick={() => startEditing(item)}
                        size="sm"
                        variant="secondary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t("common.edit")}
                      </Button>
                      <Button
                        aria-label={t("grocery.items.removeAriaLabel", {
                          name: item.name
                        })}
                        onClick={() => removeItem(item.id)}
                        size="sm"
                        variant="danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("common.remove")}
                      </Button>
                    </div>
                  </li>
                );
              }

              return (
                <li
                  className="space-y-3 rounded-2xl border border-brand-border bg-surface px-4 py-3"
                  key={item.id}
                  ref={registerRow(item.id)}
                >
                  <div className="grid gap-3 sm:grid-cols-4">
                    <TextField
                      fieldClassName="sm:col-span-2"
                      label={t("common.name")}
                      onChange={(event) =>
                        setEditingRows((currentRows) => ({
                          ...currentRows,
                          [item.id]: { ...editingRow, name: event.target.value }
                        }))
                      }
                      value={editingRow.name}
                    />
                    <TextField
                      label={t("common.quantity")}
                      min="1"
                      onChange={(event) =>
                        setEditingRows((currentRows) => ({
                          ...currentRows,
                          [item.id]: { ...editingRow, quantity: event.target.value }
                        }))
                      }
                      step="1"
                      type="number"
                      value={editingRow.quantity}
                    />
                    <TextField
                      label={t("common.unit")}
                      onChange={(event) =>
                        setEditingRows((currentRows) => ({
                          ...currentRows,
                          [item.id]: { ...editingRow, unit: event.target.value }
                        }))
                      }
                      value={editingRow.unit}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => saveItem(item.id)} size="sm">
                      {t("common.save")}
                    </Button>
                    <Button
                      onClick={() => cancelEditing(item.id)}
                      size="sm"
                      variant="secondary"
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </section>
  );
}
