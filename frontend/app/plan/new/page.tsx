"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, PlusCircle } from "lucide-react";
import { backendApiUrl } from "../../../lib/auth";
import Alert from "../../../components/ui/Alert";
import Button, { buttonClassName } from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { TextField } from "../../../components/ui/Field";
import PageHeader from "../../../components/ui/PageHeader";

const toDayKey = (date: Date) => date.toISOString().slice(0, 10);

const getDefaultRange = () => {
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 6);

  return {
    startDate: toDayKey(startDate),
    endDate: toDayKey(endDate)
  };
};

export default function NewPlanPage() {
  const router = useRouter();
  const defaults = useMemo(() => getDefaultRange(), []);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${backendApiUrl}/api/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim() || null,
          startDate,
          endDate
        })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        setErrorMessage(data?.message ?? "Could not create plan.");
        return;
      }

      const data = (await response.json()) as { plan: { id: number } };
      router.push(`/plan/${data.plan.id}`);
      router.refresh();
    } catch (_error) {
      setErrorMessage("Could not create plan right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition hover:text-brand"
          href="/plan"
        >
          <ArrowLeft className="h-4 w-4" />
          All plans
        </Link>
      </div>

      <PageHeader
        description="Choose the days your week runs from and to. A day card is created for every date in the range."
        eyebrow="New plan"
        eyebrowIcon={<CalendarPlus className="h-3.5 w-3.5" />}
        title="Create a plan"
      />

      <Card>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <TextField
            hint="Leave blank to let the app name the plan from its date range."
            label="Plan name (optional)"
            onChange={(event) => setName(event.target.value)}
            placeholder="Example: Sunday to Saturday"
            type="text"
            value={name}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Start date"
              onChange={(event) => setStartDate(event.target.value)}
              required
              type="date"
              value={startDate}
            />
            <TextField
              label="End date"
              onChange={(event) => setEndDate(event.target.value)}
              required
              type="date"
              value={endDate}
            />
          </div>

          {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

          <div className="flex flex-wrap gap-3">
            <Button disabled={isSubmitting} size="lg" type="submit">
              <PlusCircle className="h-4 w-4" />
              {isSubmitting ? "Creating..." : "Create plan"}
            </Button>
            <Link
              className={buttonClassName({ size: "lg", variant: "secondary" })}
              href="/plan"
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </section>
  );
}
