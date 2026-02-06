"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { backendApiUrl } from "../../../../lib/auth";

type MealRef = {
  id: number;
  name: string;
};

type PlanPayload = {
  id: number;
  date: string;
  dinnerDish: MealRef | null;
  lunchDishes: MealRef[];
};

type GroceryItem = {
  id: number;
  name: string;
  quantity: number;
  unit: string | null;
  category: "GENERAL" | "INGREDIENT";
  isChecked: boolean;
  dinnerDish: MealRef | null;
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
  plan: PlanPayload;
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

export default function GroceryListPage() {
  const params = useParams<{ id: string }>();
  const planId = Number(params.id);
  const [plan, setPlan] = useState<PlanPayload | null>(null);
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
  const [selectedMealType, setSelectedMealType] = useState<"dinner" | "lunch">("dinner");
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
      setPlan(data.plan);
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
    if (!plan) {
      return [] as Array<{ id: string; label: string }>;
    }

    if (selectedMealType === "dinner") {
      return plan.dinnerDish
        ? [{ id: String(plan.dinnerDish.id), label: `Dinner: ${plan.dinnerDish.name}` }]
        : [];
    }

    return plan.lunchDishes.map((lunch) => ({ id: String(lunch.id), label: `Lunch: ${lunch.name}` }));
  }, [plan, selectedMealType]);

  useEffect(() => {
    setSelectedMealId(mealOptions[0]?.id ?? "");
  }, [mealOptions]);

  const createShareLink = async () => {
    const response = await fetch(`${backendApiUrl}/api/plans/${planId}/share-link`, {
      method: "POST",
      credentials: "include"
    });

    if (!response.ok) {
      setShareFeedback("Could not create share link.");
      return;
    }

    const data = (await response.json()) as { token: string };
    const nextShareLink = `${window.location.origin}/grocery/${data.token}`;
    setShareLink(nextShareLink);
    setShareFeedback("Share link is ready.");
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
    setEditingRows((currentRows) => {
      const nextRows = { ...currentRows };
      delete nextRows[itemId];
      return nextRows;
    });
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
    return <p className="text-sm text-slate-600">Loading grocery list...</p>;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Grocery list</h1>
        <p className="text-sm text-slate-500">Plan #{params.id}</p>
        <p className="text-xs text-slate-400">Realtime: {isRealtimeConnected ? "connected" : "reconnecting..."}</p>
      </header>

      {errorMessage ? <p className="text-sm text-rose-700">{errorMessage}</p> : null}
      {feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}

      <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Share grocery list</h2>
        <p className="text-sm text-slate-500">Create or rotate a public link for checking items while shopping.</p>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={createShareLink}>Create / rotate link</button>
          <button className="rounded-full border px-4 py-2 text-sm font-semibold" type="button" onClick={copyShareLink}>Copy link</button>
        </div>
        {shareLink ? <p className="break-all text-sm text-slate-700">{shareLink}</p> : null}
        {shareFeedback ? <p className="text-sm text-slate-600">{shareFeedback}</p> : null}
      </article>

      <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Add general item</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input className="rounded border px-3 py-2" placeholder="Name" value={generalName} onChange={(event) => setGeneralName(event.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Quantity" type="number" min="0.1" step="0.1" value={generalQuantity} onChange={(event) => setGeneralQuantity(event.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Unit (optional)" value={generalUnit} onChange={(event) => setGeneralUnit(event.target.value)} />
        </div>
        <button className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={createGeneralItem}>Add general item</button>
      </article>

      <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Add ingredient for meal</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <select className="rounded border px-3 py-2" value={selectedMealType} onChange={(event) => setSelectedMealType(event.target.value as "dinner" | "lunch")}>
            <option value="dinner">Dinner</option>
            <option value="lunch">Lunch</option>
          </select>
          <select className="rounded border px-3 py-2" value={selectedMealId} onChange={(event) => setSelectedMealId(event.target.value)}>
            <option value="">Select meal</option>
            {mealOptions.map((meal) => (
              <option key={meal.id} value={meal.id}>{meal.label}</option>
            ))}
          </select>
          <input className="rounded border px-3 py-2" placeholder="Ingredient name" value={ingredientName} onChange={(event) => setIngredientName(event.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Quantity" type="number" min="0.1" step="0.1" value={ingredientQuantity} onChange={(event) => setIngredientQuantity(event.target.value)} />
          <input className="rounded border px-3 py-2 md:col-span-2" placeholder="Unit (optional)" value={ingredientUnit} onChange={(event) => setIngredientUnit(event.target.value)} />
        </div>
        <button className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={createIngredientItem}>Add ingredient item</button>
      </article>

      <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Merged grocery list</h2>
        {mergedItems.length === 0 ? <p className="text-sm text-slate-500">No grocery items yet.</p> : null}
        {mergedItems.map((item) => (
          <div key={item.key} className="rounded border border-slate-200 p-3">
            <p className="font-medium text-slate-900">{item.name} — {item.quantity} {item.unit ?? ""}</p>
            <p className="text-xs text-slate-500">{item.category} · {item.sourceLabels.join(", ")}</p>
          </div>
        ))}
      </article>

      <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Edit or remove items</h2>
        {groceryItems.length === 0 ? <p className="text-sm text-slate-500">No items available.</p> : null}
        {groceryItems.map((item) => {
          const editingRow = editingRows[item.id];

          return (
            <div key={item.id} className="space-y-2 rounded border border-slate-200 p-3">
              {!editingRow ? (
                <>
                  <p className={item.isChecked ? "text-sm font-medium text-slate-400 line-through" : "text-sm font-medium text-slate-900"}>{item.name} ({item.quantity} {item.unit ?? ""})</p>
                  <p className="text-xs text-slate-500">{item.category} {item.dinnerDish ? `· Dinner: ${item.dinnerDish.name}` : ""} {item.lunchDish ? `· Lunch: ${item.lunchDish.name}` : ""}</p>
                  <div className="flex gap-2">
                    <button className="rounded-full border px-3 py-1 text-sm" type="button" onClick={() => startEditing(item)}>Edit</button>
                    <button className="rounded-full border border-rose-300 px-3 py-1 text-sm text-rose-700" type="button" onClick={() => removeItem(item.id)}>Remove</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-2 md:grid-cols-3">
                    <input className="rounded border px-3 py-2" value={editingRow.name} onChange={(event) => setEditingRows((currentRows) => ({ ...currentRows, [item.id]: { ...editingRow, name: event.target.value } }))} />
                    <input className="rounded border px-3 py-2" type="number" min="0.1" step="0.1" value={editingRow.quantity} onChange={(event) => setEditingRows((currentRows) => ({ ...currentRows, [item.id]: { ...editingRow, quantity: event.target.value } }))} />
                    <input className="rounded border px-3 py-2" value={editingRow.unit} onChange={(event) => setEditingRows((currentRows) => ({ ...currentRows, [item.id]: { ...editingRow, unit: event.target.value } }))} />
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-full bg-emerald-600 px-3 py-1 text-sm text-white" type="button" onClick={() => saveItem(item.id)}>Save</button>
                    <button className="rounded-full border px-3 py-1 text-sm" type="button" onClick={() => setEditingRows((currentRows) => {
                      const nextRows = { ...currentRows };
                      delete nextRows[item.id];
                      return nextRows;
                    })}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </article>
    </section>
  );
}
