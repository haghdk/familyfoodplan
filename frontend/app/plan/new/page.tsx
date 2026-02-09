"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { backendApiUrl } from "../../../lib/auth";

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
        <h1 className="text-3xl font-semibold text-slate-900">Create a new plan</h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose your start and end dates to create a plan you can fill with dinners and lunches.
        </p>
      </div>

      <form
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        <label className="block text-sm font-medium text-slate-700" htmlFor="name">
          Plan name (optional)
          <input
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none"
            id="name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Example: Sunday to Saturday"
            type="text"
            value={name}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor="startDate">
            Start date
            <input
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none"
              id="startDate"
              onChange={(event) => setStartDate(event.target.value)}
              required
              type="date"
              value={startDate}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700" htmlFor="endDate">
            End date
            <input
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none"
              id="endDate"
              onChange={(event) => setEndDate(event.target.value)}
              required
              type="date"
              value={endDate}
            />
          </label>
        </div>

        {errorMessage ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Creating..." : "Create plan"}
          </button>
          <Link
            className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
            href="/plan"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
