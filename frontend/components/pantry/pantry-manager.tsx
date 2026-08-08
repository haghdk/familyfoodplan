"use client";

import { useMemo, useState } from "react";
import { Archive, CalendarClock, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import { cn } from "../../lib/cn";
import { useTranslations } from "../../lib/i18n/client";
import { localeHeader } from "../../lib/i18n/requestHeaders";
import PantryForm, { type PantryFormValues } from "./pantry-form";
import Alert from "../ui/Alert";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card, { SectionCard } from "../ui/Card";
import ConfirmModal from "../ui/ConfirmModal";
import EmptyState from "../ui/EmptyState";

export type PantryItem = {
  id: number;
  name: string;
  quantity: number;
  unit: string | null;
  expirationDate: string | null;
  notes: string | null;
};

type PantryManagerProps = {
  initialPantryItems: PantryItem[];
  todayDayKey: string;
  expiryWarningDays: number;
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;

const daysUntil = (dayKey: string, todayDayKey: string) =>
  Math.round(
    (new Date(`${dayKey}T00:00:00.000Z`).getTime() -
      new Date(`${todayDayKey}T00:00:00.000Z`).getTime()) /
      millisecondsPerDay
  );

export default function PantryManager({
  initialPantryItems,
  todayDayKey,
  expiryWarningDays
}: PantryManagerProps) {
  const { locale, t, plural } = useTranslations();
  const [pantryItems, setPantryItems] = useState(initialPantryItems);
  const [isCreating, setIsCreating] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [itemPendingDeletion, setItemPendingDeletion] = useState<PantryItem | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [feedback, setFeedback] = useState("");

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "da" ? "da-DK" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      }),
    [locale]
  );

  // The list arrives soonest-to-go-off first; keep that order after every edit
  // so the thing needing eating stays at the top of the screen.
  const sortItems = (items: PantryItem[]) =>
    [...items].sort((firstItem, secondItem) => {
      if (firstItem.expirationDate === secondItem.expirationDate) {
        return firstItem.name.localeCompare(secondItem.name, locale);
      }

      if (!firstItem.expirationDate) {
        return 1;
      }

      if (!secondItem.expirationDate) {
        return -1;
      }

      return firstItem.expirationDate.localeCompare(secondItem.expirationDate);
    });

  const createItem = async (values: PantryFormValues) => {
    setIsCreating(true);
    setErrorMessage("");
    setFeedback("");

    try {
      const response = await fetch(`${backendApiUrl}/api/pantry-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify(values)
      });

      if (!response.ok) {
        throw new Error("Unable to create pantry item.");
      }

      const data = (await response.json()) as { pantryItem: PantryItem };
      setPantryItems((currentItems) => sortItems([...currentItems, data.pantryItem]));
      setFeedback(t("pantry.created", { name: data.pantryItem.name }));
    } catch (_error) {
      setErrorMessage(t("pantry.createFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  const updateItem = async (itemId: number, values: PantryFormValues) => {
    setSavingItemId(itemId);
    setErrorMessage("");
    setFeedback("");

    try {
      const response = await fetch(`${backendApiUrl}/api/pantry-items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify(values)
      });

      if (!response.ok) {
        throw new Error("Unable to update pantry item.");
      }

      const data = (await response.json()) as { pantryItem: PantryItem };
      setPantryItems((currentItems) =>
        sortItems(
          currentItems.map((item) => (item.id === itemId ? data.pantryItem : item))
        )
      );
      setEditingItemId(null);
      setFeedback(t("pantry.updated", { name: data.pantryItem.name }));
    } catch (_error) {
      setErrorMessage(t("pantry.updateFailed"));
    } finally {
      setSavingItemId(null);
    }
  };

  const deleteItem = async (item: PantryItem) => {
    setSavingItemId(item.id);
    setErrorMessage("");
    setFeedback("");

    try {
      const response = await fetch(`${backendApiUrl}/api/pantry-items/${item.id}`, {
        method: "DELETE",
        headers: localeHeader(locale),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Unable to delete pantry item.");
      }

      setPantryItems((currentItems) =>
        currentItems.filter((currentItem) => currentItem.id !== item.id)
      );
      setFeedback(t("pantry.deleted", { name: item.name }));
    } catch (_error) {
      setErrorMessage(t("pantry.deleteFailed"));
    } finally {
      setSavingItemId(null);
      setItemPendingDeletion(null);
    }
  };

  const expiringCount = pantryItems.filter(
    (item) =>
      item.expirationDate && daysUntil(item.expirationDate, todayDayKey) <= expiryWarningDays
  ).length;

  const renderExpiryBadge = (item: PantryItem) => {
    if (!item.expirationDate) {
      return <Badge tone="neutral">{t("pantry.noDate")}</Badge>;
    }

    const days = daysUntil(item.expirationDate, todayDayKey);
    const formattedDate = dateFormatter.format(
      new Date(`${item.expirationDate}T00:00:00.000Z`)
    );

    if (days < 0) {
      return (
        <Badge icon={<CalendarClock className="h-3.5 w-3.5" />} tone="danger">
          {plural("pantry.expiredDaysAgo", Math.abs(days))} · {formattedDate}
        </Badge>
      );
    }

    if (days <= expiryWarningDays) {
      return (
        <Badge icon={<CalendarClock className="h-3.5 w-3.5" />} tone="warning">
          {days === 0
            ? t("pantry.expiresToday")
            : plural("pantry.expiresInDays", days)}{" "}
          · {formattedDate}
        </Badge>
      );
    }

    return <Badge tone="neutral">{formattedDate}</Badge>;
  };

  return (
    <section className="space-y-5">
      <SectionCard
        description={t("pantry.addDescription")}
        icon={<Plus className="h-4 w-4" />}
        title={t("pantry.addTitle")}
      >
        <PantryForm
          isSubmitting={isCreating}
          onSubmit={createItem}
          submitLabel={t("pantry.addSubmit")}
        />
      </SectionCard>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
      {feedback ? <Alert tone="success">{feedback}</Alert> : null}

      {expiringCount > 0 ? (
        <Alert tone="warning">
          {plural("pantry.expiringSoonBanner", expiringCount, {
            days: expiryWarningDays
          })}
        </Alert>
      ) : null}

      {pantryItems.length === 0 ? (
        <EmptyState
          description={t("pantry.emptyDescription")}
          icon={<Archive className="h-5 w-5" />}
          title={t("pantry.emptyTitle")}
        />
      ) : (
        <ul className="space-y-3">
          {pantryItems.map((item) => {
            const isExpired =
              item.expirationDate && daysUntil(item.expirationDate, todayDayKey) < 0;

            return (
              <li key={item.id}>
                <Card className={cn(isExpired ? "border-danger-border" : undefined)}>
                  {editingItemId === item.id ? (
                    <PantryForm
                      initialExpirationDate={item.expirationDate ?? ""}
                      initialName={item.name}
                      initialNotes={item.notes ?? ""}
                      initialQuantity={item.quantity}
                      initialUnit={item.unit ?? ""}
                      isSubmitting={savingItemId === item.id}
                      onCancel={() => setEditingItemId(null)}
                      onSubmit={(values) => updateItem(item.id, values)}
                      submitLabel={t("common.save")}
                    />
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                          <Package className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-fg">
                            {item.name}
                            <span className="ml-2 text-sm font-normal text-fg-muted">
                              {item.quantity}
                              {item.unit ? ` ${item.unit}` : ""}
                            </span>
                          </p>
                          <div className="mt-1">{renderExpiryBadge(item)}</div>
                          {item.notes ? (
                            <p className="mt-2 max-w-prose text-sm text-fg-muted">
                              {item.notes}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          disabled={savingItemId === item.id}
                          onClick={() => setEditingItemId(item.id)}
                          size="sm"
                          variant="secondary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t("common.edit")}
                        </Button>
                        <Button
                          disabled={savingItemId === item.id}
                          onClick={() => setItemPendingDeletion(item)}
                          size="sm"
                          variant="danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("common.remove")}
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("pantry.deleteConfirm")}
        confirmVariant="danger"
        description={t("pantry.deleteDescription")}
        isLoading={savingItemId === itemPendingDeletion?.id}
        isOpen={Boolean(itemPendingDeletion)}
        onCancel={() => setItemPendingDeletion(null)}
        onConfirm={() => {
          if (itemPendingDeletion) {
            void deleteItem(itemPendingDeletion);
          }
        }}
        title={t("pantry.deleteTitle", { name: itemPendingDeletion?.name ?? "" })}
      />
    </section>
  );
}
