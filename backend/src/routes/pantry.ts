import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdminAuth, requireAuth } from "../middleware/auth";
import {
  expiryWarningDays,
  getExpiringPantryItems
} from "../services/pantryExpiryReminder";
import { getLocalDayKey } from "../lib/localTime";
import { pantryItemSelect } from "../services/pantry";
import { parsePantryCsv } from "../services/pantryImport";
import { reminderTimeZone } from "../services/dinnerReminder";

const pantryRouter = Router();

const parsePantryItemId = (rawValue: string) => {
  const parsedValue = Number(rawValue);
  return Number.isInteger(parsedValue) ? parsedValue : null;
};

const normalizeQuantity = (quantity: unknown) =>
  typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

const normalizeOptionalText = (value: unknown) =>
  typeof value === "string" ? value.trim() || null : null;

type ParsedExpirationDate =
  | { status: "invalid" }
  | { status: "parsed"; expirationDate: Date | null };

/**
 * Expiration dates are calendar days, not instants, so they are stored at UTC
 * midnight the same way plan days are. Anything else makes "expires on the 4th"
 * depend on who is looking and from which time zone.
 */
const parseExpirationDate = (rawValue: unknown): ParsedExpirationDate => {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return { status: "parsed", expirationDate: null };
  }

  if (typeof rawValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rawValue.trim())) {
    return { status: "invalid" };
  }

  const parsedDate = new Date(`${rawValue.trim()}T00:00:00.000Z`);

  return Number.isNaN(parsedDate.getTime())
    ? { status: "invalid" }
    : { status: "parsed", expirationDate: parsedDate };
};

const formatDateKey = (date: Date | null) =>
  date ? date.toISOString().slice(0, 10) : null;

type StoredPantryItem = {
  id: number;
  name: string;
  quantity: number;
  unit: string | null;
  expirationDate: Date | null;
  notes: string | null;
};

const mapPantryItem = (pantryItem: StoredPantryItem) => ({
  ...pantryItem,
  expirationDate: formatDateKey(pantryItem.expirationDate)
});

pantryRouter.get("/api/pantry-items", requireAuth, async (_request, response) => {
  const pantryItems = await prisma.pantryItem.findMany({
    // Soonest to go off first, so what needs eating is at the top of the screen.
    // Undated staples sort after everything dated, by name.
    orderBy: [{ expirationDate: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    select: pantryItemSelect
  });

  response.status(200).json({
    pantryItems: pantryItems.map(mapPantryItem),
    todayDayKey: getLocalDayKey(reminderTimeZone),
    expiryWarningDays
  });
});

pantryRouter.get("/api/pantry-items/expiring", requireAuth, async (_request, response) => {
  const todayDayKey = getLocalDayKey(reminderTimeZone);

  response.status(200).json({
    pantryItems: await getExpiringPantryItems(todayDayKey, expiryWarningDays),
    todayDayKey,
    expiryWarningDays
  });
});

pantryRouter.post("/api/pantry-items", requireAdminAuth, async (request, response) => {
  const { name, quantity, unit, expirationDate, notes } = request.body as {
    name?: unknown;
    quantity?: unknown;
    unit?: unknown;
    expirationDate?: unknown;
    notes?: unknown;
  };

  const normalizedName = typeof name === "string" ? name.trim() : "";

  if (!normalizedName) {
    response.status(400).json({ message: "Pantry item name is required." });
    return;
  }

  const parsedExpirationDate = parseExpirationDate(expirationDate);

  if (parsedExpirationDate.status === "invalid") {
    response
      .status(400)
      .json({ message: "Invalid expiration date. Expected YYYY-MM-DD." });
    return;
  }

  const pantryItem = await prisma.pantryItem.create({
    data: {
      name: normalizedName,
      quantity: normalizeQuantity(quantity),
      unit: normalizeOptionalText(unit),
      expirationDate: parsedExpirationDate.expirationDate,
      notes: normalizeOptionalText(notes)
    },
    select: pantryItemSelect
  });

  response.status(201).json({ pantryItem: mapPantryItem(pantryItem) });
});

/**
 * Bulk import from a spreadsheet stocktake.
 *
 * `dryRun` parses and reports without writing, which is what the screen does
 * first: thirty lines of cabinet contents deserve a look before they land, and
 * a mistyped date should be visible rather than silently dropped.
 *
 * `mode` is "append" by default. "replace" empties the pantry first, which is
 * what a full cabinet check-up actually means — the list in hand *is* the new
 * state of the shelves.
 */
pantryRouter.post("/api/pantry-items/import", requireAdminAuth, async (request, response) => {
  const { csv, dryRun, mode } = request.body as {
    csv?: unknown;
    dryRun?: unknown;
    mode?: unknown;
  };

  if (typeof csv !== "string" || !csv.trim()) {
    response.status(400).json({ message: "A CSV body is required." });
    return;
  }

  if (mode !== undefined && mode !== "append" && mode !== "replace") {
    response.status(400).json({ message: 'mode must be "append" or "replace".' });
    return;
  }

  const parseResult = parsePantryCsv(csv);

  if (parseResult.status === "empty") {
    response.status(400).json({ message: "That file has no rows." });
    return;
  }

  if (parseResult.status === "missing_name_column") {
    response.status(400).json({
      message:
        "No item-name column found. The first row must name the columns, for example: Madvare,Mængde,Enhed,Udløbsdato,Noter",
      foundHeaders: parseResult.foundHeaders
    });
    return;
  }

  const importMode = mode === "replace" ? "replace" : "append";
  const isDryRun = dryRun !== false;

  if (isDryRun) {
    response.status(200).json({
      dryRun: true,
      mode: importMode,
      delimiter: parseResult.delimiter,
      rows: parseResult.rows,
      errors: parseResult.errors,
      importedCount: 0,
      replacedCount:
        importMode === "replace" ? await prisma.pantryItem.count() : 0
    });
    return;
  }

  if (parseResult.rows.length === 0) {
    response.status(400).json({
      message: "None of the lines could be read, so nothing was imported.",
      errors: parseResult.errors
    });
    return;
  }

  // One transaction, so a replace that fails part way through cannot leave the
  // cabinets emptied with nothing written back.
  const { replacedCount } = await prisma.$transaction(async (tx) => {
    const replacedCount =
      importMode === "replace" ? (await tx.pantryItem.deleteMany({})).count : 0;

    await tx.pantryItem.createMany({
      data: parseResult.rows.map((row) => ({
        name: row.name,
        quantity: row.quantity,
        unit: row.unit,
        expirationDate: row.expirationDate
          ? new Date(`${row.expirationDate}T00:00:00.000Z`)
          : null,
        notes: row.notes
      }))
    });

    return { replacedCount };
  });

  const pantryItems = await prisma.pantryItem.findMany({
    orderBy: [{ expirationDate: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    select: pantryItemSelect
  });

  response.status(201).json({
    dryRun: false,
    mode: importMode,
    delimiter: parseResult.delimiter,
    rows: parseResult.rows,
    errors: parseResult.errors,
    importedCount: parseResult.rows.length,
    replacedCount,
    pantryItems: pantryItems.map(mapPantryItem)
  });
});

pantryRouter.put("/api/pantry-items/:itemId", requireAdminAuth, async (request, response) => {
  const itemId = parsePantryItemId(request.params.itemId);

  if (itemId === null) {
    response.status(400).json({ message: "Invalid pantry item id." });
    return;
  }

  const { name, quantity, unit, expirationDate, notes } = request.body as {
    name?: unknown;
    quantity?: unknown;
    unit?: unknown;
    expirationDate?: unknown;
    notes?: unknown;
  };

  const normalizedName = typeof name === "string" ? name.trim() : "";

  if (!normalizedName) {
    response.status(400).json({ message: "Pantry item name is required." });
    return;
  }

  const parsedExpirationDate = parseExpirationDate(expirationDate);

  if (parsedExpirationDate.status === "invalid") {
    response
      .status(400)
      .json({ message: "Invalid expiration date. Expected YYYY-MM-DD." });
    return;
  }

  const existingItem = await prisma.pantryItem.findUnique({
    where: { id: itemId },
    select: { id: true }
  });

  if (!existingItem) {
    response.status(404).json({ message: "Pantry item not found." });
    return;
  }

  const pantryItem = await prisma.pantryItem.update({
    where: { id: itemId },
    data: {
      name: normalizedName,
      quantity: normalizeQuantity(quantity),
      unit: normalizeOptionalText(unit),
      expirationDate: parsedExpirationDate.expirationDate,
      notes: normalizeOptionalText(notes)
    },
    select: pantryItemSelect
  });

  response.status(200).json({ pantryItem: mapPantryItem(pantryItem) });
});

pantryRouter.delete(
  "/api/pantry-items/:itemId",
  requireAdminAuth,
  async (request, response) => {
    const itemId = parsePantryItemId(request.params.itemId);

    if (itemId === null) {
      response.status(400).json({ message: "Invalid pantry item id." });
      return;
    }

    const existingItem = await prisma.pantryItem.findUnique({
      where: { id: itemId },
      select: { id: true }
    });

    if (!existingItem) {
      response.status(404).json({ message: "Pantry item not found." });
      return;
    }

    await prisma.pantryItem.delete({ where: { id: itemId } });

    response.status(204).send();
  }
);

export default pantryRouter;
