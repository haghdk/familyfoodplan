"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, CalendarClock } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import { useTranslations } from "../../lib/i18n/client";
import Badge from "../ui/Badge";

type PlanPantryMatch = {
  name: string;
  unit: string | null;
  neededQuantity: number;
  pantryQuantity: number;
  isFullyCovered: boolean;
  expirationDate: string | null;
  mealLabels: string[];
};

type PlanPantryBannerProps = {
  planId: number;
};

const formatAmount = (quantity: number, unit: string | null) =>
  `${quantity}${unit ? ` ${unit}` : ""}`;

/**
 * "You already have the corn." Shows what this week's dishes ask for that is
 * sitting in the kitchen cabinets, before anyone writes a shopping list.
 *
 * It is deliberately quiet: with nothing matching, the banner renders nothing at
 * all rather than an empty box saying so.
 */
export default function PlanPantryBanner({ planId }: PlanPantryBannerProps) {
  const { t, plural } = useTranslations();
  const [matches, setMatches] = useState<PlanPantryMatch[]>([]);

  useEffect(() => {
    let isActive = true;

    const loadMatches = async () => {
      try {
        const response = await fetch(
          `${backendApiUrl}/api/plans/${planId}/pantry-matches`,
          { credentials: "include" }
        );

        if (!response.ok) {
          throw new Error("Unable to load pantry matches.");
        }

        const data = (await response.json()) as { matches: PlanPantryMatch[] };

        if (isActive) {
          setMatches(data.matches);
        }
      } catch (_error) {
        // A pantry hint is a nicety, not the plan. Staying silent is better than
        // an error banner over a week someone is trying to read.
        if (isActive) {
          setMatches([]);
        }
      }
    };

    void loadMatches();

    return () => {
      isActive = false;
    };
  }, [planId]);

  if (matches.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-accent-border bg-accent-soft/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent shadow-card">
            <Archive className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-fg">
              {plural("planPantry.title", matches.length)}
            </h2>
            <p className="mt-1 max-w-prose text-sm text-fg-muted">
              {t("planPantry.description")}
            </p>
          </div>
        </div>
        <Link
          className="text-sm font-medium text-fg-muted underline-offset-4 transition hover:text-brand hover:underline"
          href="/pantry"
        >
          {t("planPantry.openPantry")}
        </Link>
      </div>

      <ul className="mt-4 space-y-2">
        {matches.map((match) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3"
            key={`${match.name}-${match.unit ?? ""}`}
          >
            <div className="min-w-0">
              <p className="font-medium text-fg">
                {match.name}
                <span className="ml-2 text-sm font-normal text-fg-muted">
                  {t("planPantry.haveOfNeeded", {
                    have: formatAmount(match.pantryQuantity, match.unit),
                    needed: formatAmount(match.neededQuantity, match.unit)
                  })}
                </span>
              </p>
              <p className="mt-0.5 truncate text-xs text-fg-subtle">
                {match.mealLabels.join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {match.expirationDate ? (
                <Badge icon={<CalendarClock className="h-3.5 w-3.5" />} tone="neutral">
                  {match.expirationDate}
                </Badge>
              ) : null}
              <Badge tone={match.isFullyCovered ? "brand" : "warning"}>
                {match.isFullyCovered
                  ? t("planPantry.covered")
                  : t("planPantry.partiallyCovered")}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
