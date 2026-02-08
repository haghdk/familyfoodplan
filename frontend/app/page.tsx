import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-8">
      <div className="rounded-3xl bg-white p-10 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
          Weekly planning made simple
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-slate-900">
          Plan meals for the whole family in one shared calendar.
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Family Food Planner helps you pick your start and end days, capture
          recipes everyone loves, and build a reusable weekly rhythm for
          breakfast, lunch, and dinner.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            href="/plan"
          >
            Get started
          </Link>
          <button
            className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
            type="button"
          >
            View sample plan
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Flexible week ranges",
            description:
              "Start planning on any day of the week and keep your plan running through the end day that fits your household."
          },
          {
            title: "Shared grocery prep",
            description:
              "Auto-generate a unified grocery list so everyone can shop once and cook together."
          },
          {
            title: "Family-friendly routines",
            description:
              "Save favorite meals, assign themes, and build a repeatable plan that reduces decision fatigue."
          }
        ].map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              {feature.title}
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
