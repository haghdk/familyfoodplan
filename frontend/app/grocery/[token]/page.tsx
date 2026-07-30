"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check, ShoppingBasket } from "lucide-react";
import { backendApiUrl } from "../../../lib/auth";
import { cn } from "../../../lib/cn";
import Alert from "../../../components/ui/Alert";
import Card from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";

type MealRef = {
  id: number;
  name: string;
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

type SharedResponse = {
  plan: {
    id: number;
    date: string;
    name?: string;
    startDate?: string | null;
    endDate?: string | null;
  };
  groceryItems: GroceryItem[];
};

type UpdateGroceryItemResponse = {
  groceryItem: GroceryItem;
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

// Keeps the shopping list in the manual order the plan owner arranged, so the
// list follows the route through the store.
const sortItemsByIdOrder = (items: GroceryItem[], orderedItemIds: number[]) => {
  const positionByItemId = new Map(orderedItemIds.map((itemId, position) => [itemId, position]));

  return [...items].sort(
    (firstItem, secondItem) =>
      (positionByItemId.get(firstItem.id) ?? Number.MAX_SAFE_INTEGER) -
      (positionByItemId.get(secondItem.id) ?? Number.MAX_SAFE_INTEGER)
  );
};

// Tells the shopper what an ingredient is for, so a line they do not recognise
// can still be traced back to the meal it was added for.
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

  return "General";
};

const formatDate = (dateValue: string) => {
  const parsedDate = new Date(dateValue);

  return Number.isNaN(parsedDate.valueOf()) ? "" : parsedDate.toLocaleDateString();
};

export default function SharedGroceryPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [planPeriod, setPlanPeriod] = useState("");
  const [items, setItems] = useState<GroceryItem[]>([]);

  const loadSharedList = useCallback(
    async ({ showLoadingState = true }: { showLoadingState?: boolean } = {}) => {
      if (showLoadingState) {
        setIsLoading(true);
      }

      setErrorMessage("");

      // Shopping happens on a phone, in a shop, on a connection that comes and
      // goes, so a failed load has to leave a page that can recover instead of
      // an endless skeleton: the poll below retries until the list arrives.
      try {
        const response = await fetch(`${backendApiUrl}/api/grocery/shared/${token}`);

        if (!response.ok) {
          setErrorMessage("Shared list not found or no longer available.");
          setIsLoading(false);
          return;
        }

        const data = (await response.json()) as SharedResponse;
        const startLabel = formatDate(data.plan.startDate ?? data.plan.date);
        const endLabel = data.plan.endDate ? formatDate(data.plan.endDate) : "";

        setPlanPeriod(
          endLabel && endLabel !== startLabel ? `${startLabel} – ${endLabel}` : startLabel
        );
        setItems(data.groceryItems);
      } catch (_error) {
        setErrorMessage("Could not reach the grocery list. Retrying...");
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void loadSharedList();
  }, [loadSharedList]);

  useEffect(() => {
    let isMounted = true;
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let hasConnectedBefore = false;

    const handleRealtimeEvent = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as GroceryRealtimeEvent;

      setItems((currentItems) => {
        if (payload.eventType === "grocery_items_reordered" && payload.orderedItemIds) {
          return sortItemsByIdOrder(currentItems, payload.orderedItemIds);
        }

        if (payload.eventType === "grocery_item_deleted" && payload.deletedItemId) {
          return currentItems.filter((item) => item.id !== payload.deletedItemId);
        }

        if (!payload.item) {
          return currentItems;
        }

        const existingItemIndex = currentItems.findIndex((item) => item.id === payload.item?.id);

        // New items are appended, matching the plan-wide manual order where the
        // newest item sits last until someone drags it into place.
        if (existingItemIndex === -1) {
          return [...currentItems, payload.item];
        }

        return currentItems.map((item) => (item.id === payload.item?.id ? payload.item : item));
      });
    };

    const connect = () => {
      // The share token is the only credential this page has, so the stream is
      // opened without cookies: it keeps the request a plain cross-origin GET.
      eventSource = new EventSource(`${backendApiUrl}/api/realtime/grocery/shared/${token}`);

      eventSource.onopen = () => {
        if (!isMounted) {
          return;
        }

        setIsRealtimeConnected(true);
        reconnectAttempts = 0;

        // Anything that changed while the stream was down is only visible after
        // a refetch, so reconnecting always resyncs the whole list.
        if (hasConnectedBefore) {
          void loadSharedList({ showLoadingState: false });
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

        // A stream that merely dropped is retried by the browser itself. One
        // that was closed — refused by a proxy, or answered with an error
        // status — stays closed forever unless we open a new one.
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
  }, [loadSharedList, token]);

  // Live updates are the fast path, not the only path: a proxy that blocks
  // server-sent events, or a phone that lost the stream mid-shop, would
  // otherwise leave two people in the same store looking at different lists.
  useEffect(() => {
    if (isRealtimeConnected) {
      return;
    }

    const pollInterval = setInterval(() => {
      void loadSharedList({ showLoadingState: false });
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [isRealtimeConnected, loadSharedList]);

  const toggleItem = async (item: GroceryItem) => {
    let response: Response;

    try {
      response = await fetch(`${backendApiUrl}/api/grocery/shared/${token}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isChecked: !item.isChecked })
      });
    } catch (_error) {
      setErrorMessage("Could not reach the grocery list. That tick was not saved.");
      return;
    }

    if (!response.ok) {
      setErrorMessage("Could not update item state.");
      return;
    }

    setErrorMessage("");

    const data = (await response.json()) as UpdateGroceryItemResponse;

    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === item.id
          ? data.groceryItem
          : currentItem
      )
    );
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="h-24 animate-pulse rounded-3xl bg-surface-muted" />
        <div className="h-72 animate-pulse rounded-3xl bg-surface-muted" />
        <span className="sr-only">Loading shared grocery list...</span>
      </div>
    );
  }

  const checkedCount = items.filter((item) => item.isChecked).length;
  const progressPercentage =
    items.length === 0 ? 0 : Math.round((checkedCount / items.length) * 100);

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              <ShoppingBasket className="h-4 w-4" />
              Shared list
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
              Grocery list
            </h1>
            {planPeriod ? (
              <p className="mt-1 text-sm text-fg-muted">Plan period: {planPeriod}</p>
            ) : null}
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-fg-muted">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isRealtimeConnected ? "bg-success" : "bg-warning"
              )}
            />
            {isRealtimeConnected ? "Live" : "Reconnecting"}
          </span>
        </div>

        {items.length > 0 ? (
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-fg">
                {checkedCount} of {items.length} picked up
              </span>
              <span className="text-fg-subtle">{progressPercentage}%</span>
            </div>
            <div
              aria-label="Shopping progress"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={progressPercentage}
              className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        ) : null}
      </Card>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      {items.length === 0 ? (
        <EmptyState
          description="When the plan owner adds items they will appear here instantly."
          icon={<ShoppingBasket className="h-5 w-5" />}
          title="Nothing to shop for yet"
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-2xl border bg-surface p-4 transition",
                  item.isChecked
                    ? "border-border bg-surface-muted/60"
                    : "border-border hover:border-brand-border"
                )}
              >
                <input
                  checked={item.isChecked}
                  className="peer sr-only"
                  onChange={() => void toggleItem(item)}
                  type="checkbox"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand/45",
                    item.isChecked
                      ? "border-brand bg-brand text-brand-fg"
                      : "border-border-strong bg-surface text-transparent"
                  )}
                >
                  <Check className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block font-medium",
                      item.isChecked ? "text-fg-subtle line-through" : "text-fg"
                    )}
                  >
                    {item.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-fg-subtle">
                    {item.quantity}
                    {item.unit ? ` ${item.unit}` : ""}
                    <span className="mx-1.5">•</span>
                    {describeItemSource(item)}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
