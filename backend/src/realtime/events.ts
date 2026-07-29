export type GroceryEventType =
  | "grocery_item_created"
  | "grocery_item_updated"
  | "grocery_item_deleted"
  | "grocery_items_reordered";

export type GroceryEventPayload = {
  eventType: GroceryEventType;
  planId: number;
  token: string | null;
  item: {
    id: number;
    name: string;
    quantity: number;
    unit: string | null;
    category: "GENERAL" | "INGREDIENT";
    isChecked: boolean;
    dinnerDish: { id: number; name: string } | null;
    lunchDish: { id: number; name: string } | null;
  } | null;
  deletedItemId: number | null;
  // Set on `grocery_items_reordered` events: the full plan-wide item order
  // listeners should apply to the rows they already hold.
  orderedItemIds: number[] | null;
};

export type RealtimeListener = (payload: GroceryEventPayload) => void;

class RealtimeBus {
  private listeners = new Set<RealtimeListener>();

  subscribe(listener: RealtimeListener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(payload: GroceryEventPayload) {
    this.listeners.forEach((listener) => {
      listener(payload);
    });
  }
}

export const realtimeBus = new RealtimeBus();
