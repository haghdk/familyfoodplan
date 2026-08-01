type OrderableGroceryItem = {
  id: number;
};

type PickableGroceryItem = {
  isChecked: boolean;
};

/**
 * Applies a plan-wide item order to the rows currently held in state, so every
 * view follows the manual order set on the merged shopping list.
 */
export const sortItemsByIdOrder = <TItem extends OrderableGroceryItem>(
  items: TItem[],
  orderedItemIds: number[]
) => {
  const positionByItemId = new Map(orderedItemIds.map((itemId, position) => [itemId, position]));

  return [...items].sort(
    (firstItem, secondItem) =>
      (positionByItemId.get(firstItem.id) ?? Number.MAX_SAFE_INTEGER) -
      (positionByItemId.get(secondItem.id) ?? Number.MAX_SAFE_INTEGER)
  );
};

/**
 * Moves everything already picked up below everything still to buy, keeping
 * the shopping order inside each group. Only the presentation changes: the
 * stored order is untouched, so unticking an item that was ticked by mistake
 * puts it straight back where it was.
 */
export const sortPickedUpItemsLast = <TItem extends PickableGroceryItem>(items: TItem[]) => [
  ...items.filter((item) => !item.isChecked),
  ...items.filter((item) => item.isChecked)
];
