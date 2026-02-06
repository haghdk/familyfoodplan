"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { backendApiUrl } from "../../../lib/auth";

type GroceryItem = {
  id: number;
  name: string;
  quantity: number;
  unit: string | null;
  category: "GENERAL" | "INGREDIENT";
  isChecked: boolean;
};

type SharedResponse = {
  plan: {
    id: number;
    date: string;
  };
  groceryItems: GroceryItem[];
};

type GroceryRealtimeEvent = {
  eventType: "grocery_item_created" | "grocery_item_updated" | "grocery_item_deleted";
  planId: number;
  token: string | null;
  item: GroceryItem | null;
  deletedItemId: number | null;
};

export default function SharedGroceryPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [planDate, setPlanDate] = useState("");
  const [items, setItems] = useState<GroceryItem[]>([]);

  const loadSharedList = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    const response = await fetch(`${backendApiUrl}/api/grocery/shared/${token}`);

    if (!response.ok) {
      setErrorMessage("Shared list not found or no longer available.");
      setIsLoading(false);
      return;
    }

    const data = (await response.json()) as SharedResponse;
    setPlanDate(data.plan.date);
    setItems(data.groceryItems);
    setIsLoading(false);
  }, [token]);

  useEffect(() => {
    void loadSharedList();
  }, [loadSharedList]);

  useEffect(() => {
    let isMounted = true;
    let reconnectAttempts = 0;

    const eventSource = new EventSource(`${backendApiUrl}/api/realtime/grocery/shared/${token}`);

    eventSource.onopen = () => {
      if (!isMounted) {
        return;
      }

      setIsRealtimeConnected(true);

      if (reconnectAttempts > 0) {
        void loadSharedList();
      }

      reconnectAttempts += 1;
    };

    const handleRealtimeEvent = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as GroceryRealtimeEvent;

      setItems((currentItems) => {
        if (payload.eventType === "grocery_item_deleted" && payload.deletedItemId) {
          return currentItems.filter((item) => item.id !== payload.deletedItemId);
        }

        if (!payload.item) {
          return currentItems;
        }

        const existingItemIndex = currentItems.findIndex((item) => item.id === payload.item?.id);

        if (existingItemIndex === -1) {
          return [...currentItems, payload.item].sort((a, b) => a.name.localeCompare(b.name));
        }

        return currentItems.map((item) => (item.id === payload.item?.id ? payload.item : item));
      });
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
  }, [loadSharedList, token]);

  const toggleItem = async (item: GroceryItem) => {
    const response = await fetch(`${backendApiUrl}/api/grocery/shared/${token}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isChecked: !item.isChecked })
    });

    if (!response.ok) {
      setErrorMessage("Could not update item state.");
      return;
    }

    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, isChecked: !currentItem.isChecked }
          : currentItem
      )
    );
  };

  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading shared grocery list...</p>;
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Shared grocery list</h1>
        {planDate ? <p className="text-sm text-slate-500">Plan date: {new Date(planDate).toLocaleDateString()}</p> : null}
        <p className="text-xs text-slate-400">Realtime: {isRealtimeConnected ? "connected" : "reconnecting..."}</p>
      </header>

      {errorMessage ? <p className="text-sm text-rose-700">{errorMessage}</p> : null}

      <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        {items.length === 0 ? <p className="text-sm text-slate-500">No grocery items on this list.</p> : null}
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-3 rounded border border-slate-200 p-3">
            <input type="checkbox" checked={item.isChecked} onChange={() => void toggleItem(item)} />
            <span className={item.isChecked ? "text-slate-400 line-through" : "text-slate-900"}>
              {item.name} ({item.quantity} {item.unit ?? ""})
            </span>
          </label>
        ))}
      </article>
    </section>
  );
}
