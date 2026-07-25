"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Carrot,
  Check,
  Copy,
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
import Alert from "../../../../components/ui/Alert";
import Badge from "../../../../components/ui/Badge";
import Button from "../../../../components/ui/Button";
import { SectionCard } from "../../../../components/ui/Card";
import EmptyState from "../../../../components/ui/EmptyState";
import { SelectField, TextField, controlClassName } from "../../../../components/ui/Field";
import PageHeader from "../../../../components/ui/PageHeader";

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
  eventType: "grocery_item_created" | "grocery_item_updated" | "grocery_item_deleted";
  planId: number;
  token: string | null;
  item: GroceryItem | null;
  deletedItemId: number | null;
};

const formatQuantity = (quantity: number, unit: string | null) =>
  `${quantity}${unit ? ` ${unit}` : ""}`;

const describeItemSource = (item: GroceryItem) => {
  if (item.dinnerDish) {
    return `Dinner · ${item.dinnerDish.name}`;
  }

  if (item.breakfastDish) {
    return `Breakfast · ${item.breakfastDish.name}`;
  }

  if (item.lunchDish) {
    return `Lunch · ${item.lunchDish.name}`;
  }

  return "General item";
};

export default function GroceryListPage() {
  const params = useParams<{ id: string }>();
  const planId = Number(params.id);
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

  const loadItems = useCallback(async () => {
    setIsLoading(true);
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
      setErrorMessage("Could not load grocery list for this plan.");
    } finally {
      setIsLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (Number.isNaN(planId)) {
      setErrorMessage("Invalid plan id.");
      setIsLoading(false);
      return;
    }

    void loadItems();
  }, [loadItems, planId]);

  useEffect(() => {
    if (Number.isNaN(planId)) {
      return;
    }

    let isMounted = true;
    let reconnectAttempts = 0;

    const eventSource = new EventSource(
      `${backendApiUrl}/api/realtime/grocery/admin?planId=${planId}`,
      { withCredentials: true }
    );

    eventSource.onopen = () => {
      if (!isMounted) {
        return;
      }

      setIsRealtimeConnected(true);

      if (reconnectAttempts > 0) {
        void loadItems();
      }

      reconnectAttempts += 1;
    };

    const handleRealtimeEvent = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as GroceryRealtimeEvent;

      setGroceryItems((currentItems) => {
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

      void loadItems();
    };

    eventSource.addEventListener("grocery_item_created", handleRealtimeEvent);
    eventSource.addEventListener("grocery_item_updated", handleRealtimeEvent);
    eventSource.addEventListener("grocery_item_deleted", handleRealtimeEvent);

    eventSource.onerror = () => {
      if (!isMounted) {
        return;
      }

      setIsRealtimeConnected(false);
    };

    return () => {
      isMounted = false;
      eventSource.close();
    };
  }, [loadItems, planId]);

  const mealOptions = useMemo(() => {
    const formatDayLabel = (dateValue: string) => {
      const parsedDate = new Date(dateValue);

      if (Number.isNaN(parsedDate.valueOf())) {
        return dateValue;
      }

      return parsedDate.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric"
      });
    };

    const dinnerOptions: MealOption[] = planDays.flatMap((day) =>
      day.dinnerDish
        ? [
            {
              id: String(day.dinnerDish.id),
              label: `${formatDayLabel(day.date)} · Dinner: ${day.dinnerDish.name}`
            }
          ]
        : []
    );

    const breakfastOptions: MealOption[] = planDays.flatMap((day) =>
      day.breakfastDishes.map((breakfastDish) => ({
        id: String(breakfastDish.id),
        label: `${formatDayLabel(day.date)} · Breakfast: ${breakfastDish.name}`
      }))
    );

    const lunchOptions: MealOption[] = planDays.flatMap((day) =>
      day.lunchDishes.map((lunchDish) => ({
        id: String(lunchDish.id),
        label: `${formatDayLabel(day.date)} · Lunch: ${lunchDish.name}`
      }))
    );

    if (selectedMealType === "dinner") {
      return dinnerOptions;
    }

    return selectedMealType === "breakfast" ? breakfastOptions : lunchOptions;
  }, [planDays, selectedMealType]);

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
        credentials: "include"
      });

      if (!response.ok) {
        setShareFeedback("Could not load share link.");
        return;
      }

      const data = (await response.json()) as { token: string; existed: boolean };
      const nextShareLink = toShareUrl(data.token);
      setShareLink(nextShareLink);

      if (!showSuccessFeedback) {
        return;
      }

      setShareFeedback(data.existed ? "Existing share link loaded." : "Share link ready.");
    },
    [planId, toShareUrl]
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
      credentials: "include"
    });

    if (!response.ok) {
      setShareFeedback("Could not rotate share link.");
      return;
    }

    const data = (await response.json()) as { token: string };
    const nextShareLink = toShareUrl(data.token);
    setShareLink(nextShareLink);
    setShareFeedback("Share link rotated.");
  };

  const copyShareLink = async () => {
    if (!shareLink) {
      setShareFeedback("Create a share link first.");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      setShareFeedback("Share link copied to clipboard.");
    } catch (_error) {
      setShareFeedback("Could not copy link automatically.");
    }
  };

  const createGeneralItem = async () => {
    const name = generalName.trim();

    if (!name) {
      setFeedback("General item name is required.");
      return;
    }

    const response = await fetch(`${backendApiUrl}/api/plans/${planId}/grocery-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name,
        quantity: Number(generalQuantity) || 1,
        unit: generalUnit.trim() || null,
        category: "GENERAL"
      })
    });

    if (!response.ok) {
      setFeedback("Could not create general grocery item.");
      return;
    }

    setGeneralName("");
    setGeneralQuantity("1");
    setGeneralUnit("");
    setFeedback("General item added.");
    await loadItems();
  };

  const createIngredientItem = async () => {
    const name = ingredientName.trim();

    if (!name || !selectedMealId) {
      setFeedback("Ingredient name and meal are required.");
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
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setFeedback("Could not create ingredient item.");
      return;
    }

    setIngredientName("");
    setIngredientQuantity("1");
    setIngredientUnit("");
    setFeedback("Ingredient item added.");
    await loadItems();
  };

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
      setFeedback("Item name is required for save.");
      return;
    }

    const response = await fetch(`${backendApiUrl}/api/plans/${planId}/grocery-items/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: row.name.trim(),
        quantity: Number(row.quantity) || 1,
        unit: row.unit.trim() || null
      })
    });

    if (!response.ok) {
      setFeedback("Could not update grocery item.");
      return;
    }

    setFeedback("Grocery item updated.");
    cancelEditing(itemId);
    await loadItems();
  };

  const removeItem = async (itemId: number) => {
    const response = await fetch(`${backendApiUrl}/api/plans/${planId}/grocery-items/${itemId}`, {
      method: "DELETE",
      credentials: "include"
    });

    if (!response.ok) {
      setFeedback("Could not remove grocery item.");
      return;
    }

    setFeedback("Grocery item removed.");
    await loadItems();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-56 animate-pulse rounded-full bg-surface-muted" />
        <div className="h-40 animate-pulse rounded-3xl bg-surface-muted" />
        <div className="h-64 animate-pulse rounded-3xl bg-surface-muted" />
        <span className="sr-only">Loading grocery list...</span>
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
          Back to plan
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
            {isRealtimeConnected ? "Live updates on" : "Reconnecting..."}
          </span>
        }
        description="Everything you need to buy for this plan, synced live with anyone holding the share link."
        eyebrow="Grocery list"
        eyebrowIcon={<ShoppingBasket className="h-3.5 w-3.5" />}
        title={`Shopping for plan #${params.id}`}
      />

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
      {feedback ? <Alert tone="success">{feedback}</Alert> : null}

      <SectionCard
        description="Share this link so anyone can tick items off while shopping. Rotate it only when you need to invalidate old links."
        icon={<Link2 className="h-4 w-4" />}
        title="Share the list"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            aria-label="Share link"
            className={cn(controlClassName, "font-mono text-xs sm:text-sm")}
            placeholder="No share link yet"
            readOnly
            value={shareLink}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={copyShareLink}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button onClick={createShareLink} variant="secondary">
              <Link2 className="h-4 w-4" />
              Load / create
            </Button>
            <Button onClick={rotateShareLink} variant="secondary">
              <RefreshCw className="h-4 w-4" />
              Rotate
            </Button>
          </div>
        </div>
        {shareFeedback ? (
          <p className="mt-3 text-sm text-fg-muted">{shareFeedback}</p>
        ) : null}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          description="Household staples that are not tied to a specific meal."
          icon={<Package className="h-4 w-4" />}
          title="Add general item"
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <TextField
              fieldClassName="sm:col-span-2"
              label="Name"
              onChange={(event) => setGeneralName(event.target.value)}
              placeholder="Coffee"
              value={generalName}
            />
            <TextField
              label="Quantity"
              min="0.1"
              onChange={(event) => setGeneralQuantity(event.target.value)}
              step="0.1"
              type="number"
              value={generalQuantity}
            />
            <TextField
              label="Unit"
              onChange={(event) => setGeneralUnit(event.target.value)}
              placeholder="kg"
              value={generalUnit}
            />
          </div>
          <Button className="mt-4" onClick={createGeneralItem}>
            <Plus className="h-4 w-4" />
            Add general item
          </Button>
        </SectionCard>

        <SectionCard
          description="Ingredients linked to a meal in this plan, so you know what they are for."
          icon={<Carrot className="h-4 w-4" />}
          title="Add ingredient for a meal"
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <SelectField
              fieldClassName="sm:col-span-2"
              label="Meal type"
              onChange={(event) =>
                setSelectedMealType(event.target.value as "dinner" | "breakfast" | "lunch")
              }
              value={selectedMealType}
            >
              <option value="dinner">Dinner</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
            </SelectField>
            <SelectField
              disabled={!mealAvailability.hasAnyMeals}
              fieldClassName="sm:col-span-2"
              label="Meal"
              onChange={(event) => setSelectedMealId(event.target.value)}
              value={selectedMealId}
            >
              <option value="">Select meal</option>
              {mealOptions.map((meal) => (
                <option key={meal.id} value={meal.id}>
                  {meal.label}
                </option>
              ))}
            </SelectField>
            <TextField
              fieldClassName="sm:col-span-2"
              label="Ingredient"
              onChange={(event) => setIngredientName(event.target.value)}
              placeholder="Tomatoes"
              value={ingredientName}
            />
            <TextField
              label="Quantity"
              min="0.1"
              onChange={(event) => setIngredientQuantity(event.target.value)}
              step="0.1"
              type="number"
              value={ingredientQuantity}
            />
            <TextField
              label="Unit"
              onChange={(event) => setIngredientUnit(event.target.value)}
              placeholder="g"
              value={ingredientUnit}
            />
          </div>

          {!mealAvailability.hasAnyMeals ? (
            <Alert className="mt-3" tone="warning">
              Add at least one breakfast, lunch, or dinner dish in this plan before creating
              ingredient items.
            </Alert>
          ) : null}

          <Button className="mt-4" onClick={createIngredientItem}>
            <Plus className="h-4 w-4" />
            Add ingredient item
          </Button>
        </SectionCard>
      </div>

      <SectionCard
        actions={
          mergedItems.length > 0 ? (
            <Badge tone="brand">{mergedItems.length} lines</Badge>
          ) : null
        }
        description="Duplicate ingredients across meals are combined into a single shopping line."
        icon={<ListChecks className="h-4 w-4" />}
        title="Merged shopping list"
      >
        {mergedItems.length === 0 ? (
          <EmptyState
            description="Add a general item or a meal ingredient to start your list."
            icon={<ShoppingBasket className="h-5 w-5" />}
            title="No grocery items yet"
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {mergedItems.map((item) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3"
                key={item.key}
              >
                <div className="min-w-0">
                  <p className="font-medium text-fg">{item.name}</p>
                  <p className="mt-0.5 truncate text-xs text-fg-subtle">
                    {item.sourceLabels.join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={item.category === "GENERAL" ? "neutral" : "accent"}>
                    {item.category === "GENERAL" ? "General" : "Ingredient"}
                  </Badge>
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-sm font-semibold text-fg">
                    {formatQuantity(item.quantity, item.unit)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        actions={
          groceryItems.length > 0 ? (
            <Badge>
              {checkedItemsCount} of {groceryItems.length} checked off
            </Badge>
          ) : null
        }
        description="Every individual entry, including the meal it came from."
        icon={<Pencil className="h-4 w-4" />}
        title="Edit or remove items"
      >
        {groceryItems.length === 0 ? (
          <EmptyState
            description="Items you add above will show up here."
            icon={<Package className="h-5 w-5" />}
            title="No items available"
          />
        ) : (
          <ul className="space-y-2">
            {groceryItems.map((item) => {
              const editingRow = editingRows[item.id];

              if (!editingRow) {
                return (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-muted/40 px-4 py-3"
                    key={item.id}
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
                        {describeItemSource(item)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.isChecked ? (
                        <Badge icon={<Check className="h-3.5 w-3.5" />} tone="brand">
                          Bought
                        </Badge>
                      ) : null}
                      <Button
                        aria-label={`Edit ${item.name}`}
                        onClick={() => startEditing(item)}
                        size="sm"
                        variant="secondary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        aria-label={`Remove ${item.name}`}
                        onClick={() => removeItem(item.id)}
                        size="sm"
                        variant="danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </li>
                );
              }

              return (
                <li
                  className="space-y-3 rounded-2xl border border-brand-border bg-surface px-4 py-3"
                  key={item.id}
                >
                  <div className="grid gap-3 sm:grid-cols-4">
                    <TextField
                      fieldClassName="sm:col-span-2"
                      label="Name"
                      onChange={(event) =>
                        setEditingRows((currentRows) => ({
                          ...currentRows,
                          [item.id]: { ...editingRow, name: event.target.value }
                        }))
                      }
                      value={editingRow.name}
                    />
                    <TextField
                      label="Quantity"
                      min="0.1"
                      onChange={(event) =>
                        setEditingRows((currentRows) => ({
                          ...currentRows,
                          [item.id]: { ...editingRow, quantity: event.target.value }
                        }))
                      }
                      step="0.1"
                      type="number"
                      value={editingRow.quantity}
                    />
                    <TextField
                      label="Unit"
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
                      Save
                    </Button>
                    <Button
                      onClick={() => cancelEditing(item.id)}
                      size="sm"
                      variant="secondary"
                    >
                      Cancel
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
