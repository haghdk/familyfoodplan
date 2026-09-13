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

type PartiallyPickableGroceryItem = {
  quantity: number;
  pickedUpQuantity: number;
  isChecked: boolean;
};

/**
 * Picked up amounts are nudged a step at a time on a touch screen, and floating
 * point addition (0.1 + 0.2) would otherwise leave a line a crumb short of done
 * forever. Every amount the list sends or shows is rounded through here.
 */
export const roundPickupAmount = (amount: number) => Math.round(amount * 1000) / 1000;

/**
 * Writes an amount the way a person would: "2", not "2.00", and "0.5" rather
 * than a long tail of floating point noise.
 */
export const formatPickupAmount = (amount: number) => String(roundPickupAmount(amount));

/**
 * How much one press of the plus button picks up. Groceries are counted in
 * wildly different units — two cartons of milk, 500 g of flour — so a fixed
 * step of one would mean five hundred presses for the flour. Small amounts step
 * by whole units, larger ones by a round tenth of the line, which keeps every
 * line about ten presses from finished.
 */
export const pickupStepSize = (quantity: number) => {
  if (quantity <= 12) {
    return 1;
  }

  const roughStep = quantity / 10;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / magnitude;
  const roundedStep = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10;

  return roundedStep * magnitude;
};

// Amounts are compared with a little slack, so a line that lands on 1.9999999
// through repeated addition still counts as the two it was meant to be.
const pickupEpsilon = 0.0001;

/**
 * The amount after one more press of the plus button. Steps land on multiples
 * of the step size and then stop exactly on the full amount, so a line for
 * 2.5 kg goes 1 kg, 2 kg, 2.5 kg rather than overshooting.
 */
export const increasePickupAmount = (item: PartiallyPickableGroceryItem) => {
  const step = pickupStepSize(item.quantity);
  const nextStepBoundary = (Math.floor(item.pickedUpQuantity / step + pickupEpsilon) + 1) * step;

  return roundPickupAmount(Math.min(item.quantity, nextStepBoundary));
};

/** The mirror of {@link increasePickupAmount}, for putting something back. */
export const decreasePickupAmount = (item: PartiallyPickableGroceryItem) => {
  const step = pickupStepSize(item.quantity);
  const previousStepBoundary = (Math.ceil(item.pickedUpQuantity / step - pickupEpsilon) - 1) * step;

  return roundPickupAmount(Math.max(0, previousStepBoundary));
};

/** True while some of a line is in the basket but the rest is still to find. */
export const isPartiallyPickedUp = (item: PartiallyPickableGroceryItem) =>
  !item.isChecked && item.pickedUpQuantity > pickupEpsilon;

/**
 * How far through the shopping the list is, counting a half-picked line as
 * half done. Each line contributes its own fraction rather than its raw amount,
 * so a line measured in grams cannot drown out one counted in cartons.
 */
export const pickupProgressPercentage = (items: PartiallyPickableGroceryItem[]) => {
  if (items.length === 0) {
    return 0;
  }

  const completedFraction = items.reduce((runningTotal, item) => {
    if (item.isChecked || item.quantity <= 0) {
      return runningTotal + (item.isChecked ? 1 : 0);
    }

    return runningTotal + Math.min(item.pickedUpQuantity, item.quantity) / item.quantity;
  }, 0);

  return Math.round((completedFraction / items.length) * 100);
};
