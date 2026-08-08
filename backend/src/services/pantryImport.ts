/**
 * Reading a cabinet stocktake out of a spreadsheet.
 *
 * The file this is built for is a Danish Excel export, which brings three
 * things a naive `split(",")` gets wrong: the decimal separator is a comma
 * (`"0,5"`, quoted, in a comma-separated file), Danish Excel often switches the
 * delimiter itself to a semicolon because of that, and dates are written
 * day-first (`27-11-2026`). All three are handled here rather than being left
 * for whoever typed the list.
 */

/** One column of the import, and the header names it answers to. */
const columnAliases = {
  name: ["madvare", "vare", "navn", "name", "item", "product", "ingrediens"],
  quantity: ["mængde", "maengde", "antal", "quantity", "qty", "amount"],
  unit: ["enhed", "unit", "measure"],
  expirationDate: [
    "udløbsdato",
    "udlobsdato",
    "udløb",
    "udlob",
    "holdbarhed",
    "holdbar til",
    "expirationdate",
    "expiration date",
    "expiration",
    "expiry",
    "expires",
    "best before"
  ],
  notes: ["noter", "note", "notes", "kommentar", "comment", "bemærkning"]
} as const;

type ColumnName = keyof typeof columnAliases;

export type ImportedPantryRow = {
  /** 1-based line in the file, so a problem can be pointed at. */
  lineNumber: number;
  name: string;
  quantity: number;
  unit: string | null;
  expirationDate: string | null;
  notes: string | null;
  /** Things worth mentioning that did not stop the row being imported. */
  warnings: string[];
};

export type ImportedPantryRowError = {
  lineNumber: number;
  message: string;
  /** The row as it was written, so the user can find it in their file. */
  raw: string;
};

export type ParsedPantryCsv =
  | { status: "empty" }
  | { status: "missing_name_column"; foundHeaders: string[] }
  | {
      status: "parsed";
      rows: ImportedPantryRow[];
      errors: ImportedPantryRowError[];
      delimiter: string;
    };

/**
 * Splits delimited text into rows of fields, following the usual CSV rules:
 * quoted fields may contain the delimiter, a newline, or a doubled quote.
 * Handles CRLF and a leading byte-order mark, both of which Excel emits.
 */
export const parseDelimitedText = (text: string, delimiter: string): string[][] => {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let isQuoted = false;

  const endField = () => {
    currentRow.push(currentField);
    currentField = "";
  };

  const endRow = () => {
    endField();
    rows.push(currentRow);
    currentRow = [];
  };

  for (let index = 0; index < withoutBom.length; index += 1) {
    const character = withoutBom[index];

    if (isQuoted) {
      if (character !== '"') {
        currentField += character;
        continue;
      }

      // A doubled quote inside a quoted field is one literal quote.
      if (withoutBom[index + 1] === '"') {
        currentField += '"';
        index += 1;
        continue;
      }

      isQuoted = false;
      continue;
    }

    if (character === '"' && currentField.trim() === "") {
      // Only an opening quote at the start of a field opens a quoted run;
      // a stray quote mid-value is data.
      currentField = "";
      isQuoted = true;
      continue;
    }

    if (character === delimiter) {
      endField();
      continue;
    }

    if (character === "\r") {
      continue;
    }

    if (character === "\n") {
      endRow();
      continue;
    }

    currentField += character;
  }

  if (currentField !== "" || currentRow.length > 0) {
    endRow();
  }

  return rows;
};

/**
 * Works out which character separates the columns.
 *
 * Danish Excel writes semicolons precisely because the comma is busy being a
 * decimal separator, so the delimiter cannot be assumed. Quoted stretches are
 * skipped while counting, or the comma inside `"0,5"` would vote for itself.
 */
export const detectDelimiter = (text: string): string => {
  const candidates = [",", ";", "\t"];
  const firstLine = text
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);

  if (!firstLine) {
    return ",";
  }

  const counts = new Map<string, number>(candidates.map((candidate) => [candidate, 0]));
  let isQuoted = false;

  for (let index = 0; index < firstLine.length; index += 1) {
    const character = firstLine[index];

    if (character === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (!isQuoted && counts.has(character)) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
  }

  let bestDelimiter = ",";
  let bestCount = 0;

  for (const candidate of candidates) {
    const count = counts.get(candidate) ?? 0;

    if (count > bestCount) {
      bestDelimiter = candidate;
      bestCount = count;
    }
  }

  return bestDelimiter;
};

const normalizeHeader = (header: string) =>
  header
    .trim()
    .toLowerCase()
    // Excel sometimes leaves a non-breaking space in a pasted header.
    .replace(/ /g, " ")
    .replace(/\s+/g, " ");

const matchColumn = (header: string): ColumnName | null => {
  const normalizedHeader = normalizeHeader(header);

  for (const [columnName, aliases] of Object.entries(columnAliases) as Array<
    [ColumnName, readonly string[]]
  >) {
    if (aliases.includes(normalizedHeader)) {
      return columnName;
    }
  }

  return null;
};

export type ParsedQuantity =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "parsed"; quantity: number };

/**
 * Reads a quantity written the Danish way as readily as the English way.
 *
 * `0,5` is a half and `1.000` is a thousand, so when both separators appear the
 * dot is thousands and the comma is the decimal point; a lone comma is always
 * the decimal point.
 */
export const parseImportedQuantity = (rawValue: string): ParsedQuantity => {
  const trimmedValue = rawValue.trim().replace(/[\s ]/g, "");

  if (!trimmedValue) {
    return { status: "empty" };
  }

  const hasComma = trimmedValue.includes(",");
  const hasDot = trimmedValue.includes(".");

  const normalizedValue =
    hasComma && hasDot
      ? trimmedValue.replace(/\./g, "").replace(",", ".")
      : hasComma
        ? trimmedValue.replace(",", ".")
        : trimmedValue;

  const parsedQuantity = Number(normalizedValue);

  if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
    return { status: "invalid" };
  }

  return { status: "parsed", quantity: parsedQuantity };
};

export type ParsedImportedDate =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "parsed"; dayKey: string; wasMonthOnly: boolean };

const toDayKey = (year: number, month: number, day: number) =>
  `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;

const lastDayOfMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const isRealDate = (year: number, month: number, day: number) =>
  month >= 1 && month <= 12 && day >= 1 && day <= lastDayOfMonth(year, month);

/**
 * Reads an expiry date off a packet.
 *
 * Written dates are **day first** (`27-11-2026`), which is how the list this
 * was built for is written and how the whole of Denmark writes them. A
 * four-digit leading group is read as ISO instead, since `2026-11-27` cannot
 * mean anything else.
 *
 * A month with no day (`01 2027`) becomes the **last day of that month**, which
 * is what "best before 01/2027" means on packaging. Reading it as the first
 * would mark the tin expired for a month it is still perfectly good.
 */
export const parseImportedDate = (rawValue: string): ParsedImportedDate => {
  const trimmedValue = rawValue.trim().replace(/ /g, " ");

  if (!trimmedValue) {
    return { status: "empty" };
  }

  const isoMatch = trimmedValue.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch.map(Number);

    return isRealDate(year, month, day)
      ? { status: "parsed", dayKey: toDayKey(year, month, day), wasMonthOnly: false }
      : { status: "invalid" };
  }

  const dayFirstMatch = trimmedValue.match(
    /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4}|\d{2})$/
  );

  if (dayFirstMatch) {
    const day = Number(dayFirstMatch[1]);
    const month = Number(dayFirstMatch[2]);
    const rawYear = Number(dayFirstMatch[3]);
    const year = dayFirstMatch[3].length === 2 ? 2000 + rawYear : rawYear;

    return isRealDate(year, month, day)
      ? { status: "parsed", dayKey: toDayKey(year, month, day), wasMonthOnly: false }
      : { status: "invalid" };
  }

  const monthYearMatch = trimmedValue.match(/^(\d{1,2})[-/. ](\d{4})$/);

  if (monthYearMatch) {
    const month = Number(monthYearMatch[1]);
    const year = Number(monthYearMatch[2]);

    return month >= 1 && month <= 12
      ? {
          status: "parsed",
          dayKey: toDayKey(year, month, lastDayOfMonth(year, month)),
          wasMonthOnly: true
        }
      : { status: "invalid" };
  }

  const yearMonthMatch = trimmedValue.match(/^(\d{4})[-/. ](\d{1,2})$/);

  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1]);
    const month = Number(yearMonthMatch[2]);

    return month >= 1 && month <= 12
      ? {
          status: "parsed",
          dayKey: toDayKey(year, month, lastDayOfMonth(year, month)),
          wasMonthOnly: true
        }
      : { status: "invalid" };
  }

  return { status: "invalid" };
};

const isBlankRow = (fields: string[]) =>
  fields.every((field) => field.trim().length === 0);

/**
 * Turns a spreadsheet export into pantry rows, reporting per-line problems
 * rather than refusing the whole file: one mistyped date in a stocktake of
 * thirty tins should cost that one line, not the trip to the cabinets.
 */
export const parsePantryCsv = (csvText: string): ParsedPantryCsv => {
  if (!csvText.trim()) {
    return { status: "empty" };
  }

  const delimiter = detectDelimiter(csvText);
  const allRows = parseDelimitedText(csvText, delimiter).filter(
    (fields) => !isBlankRow(fields)
  );

  if (allRows.length === 0) {
    return { status: "empty" };
  }

  const [headerFields, ...dataRows] = allRows;
  const columnIndexes = new Map<ColumnName, number>();

  headerFields.forEach((header, index) => {
    const columnName = matchColumn(header);

    if (columnName && !columnIndexes.has(columnName)) {
      columnIndexes.set(columnName, index);
    }
  });

  if (!columnIndexes.has("name")) {
    return {
      status: "missing_name_column",
      foundHeaders: headerFields.map((header) => header.trim()).filter(Boolean)
    };
  }

  const readField = (fields: string[], columnName: ColumnName) => {
    const index = columnIndexes.get(columnName);
    return index === undefined ? "" : (fields[index] ?? "");
  };

  const rows: ImportedPantryRow[] = [];
  const errors: ImportedPantryRowError[] = [];

  dataRows.forEach((fields, dataRowIndex) => {
    // +2: one for the header row, one because files are counted from 1.
    const lineNumber = dataRowIndex + 2;
    const rawLine = fields.join(delimiter);
    const name = readField(fields, "name").trim();

    if (!name) {
      errors.push({
        lineNumber,
        message: "This line has no item name.",
        raw: rawLine
      });
      return;
    }

    const warnings: string[] = [];

    const parsedQuantity = parseImportedQuantity(readField(fields, "quantity"));

    if (parsedQuantity.status === "invalid") {
      errors.push({
        lineNumber,
        message: `"${readField(fields, "quantity").trim()}" is not a quantity.`,
        raw: rawLine
      });
      return;
    }

    // A stocktake often leaves the count off things kept by the packet rather
    // than by the number, so a blank is one of them rather than a mistake.
    const quantity = parsedQuantity.status === "empty" ? 1 : parsedQuantity.quantity;

    if (parsedQuantity.status === "empty") {
      warnings.push("No quantity given, so 1 was used.");
    }

    const rawDate = readField(fields, "expirationDate");
    const parsedDate = parseImportedDate(rawDate);

    if (parsedDate.status === "invalid") {
      errors.push({
        lineNumber,
        message: `"${rawDate.trim()}" is not a date this can read.`,
        raw: rawLine
      });
      return;
    }

    if (parsedDate.status === "parsed" && parsedDate.wasMonthOnly) {
      warnings.push(
        `"${rawDate.trim()}" gives a month but no day, so the last day of that month was used.`
      );
    }

    rows.push({
      lineNumber,
      name,
      quantity,
      unit: readField(fields, "unit").trim() || null,
      expirationDate:
        parsedDate.status === "parsed" ? parsedDate.dayKey : null,
      notes: readField(fields, "notes").trim() || null,
      warnings
    });
  });

  return { status: "parsed", rows, errors, delimiter };
};
