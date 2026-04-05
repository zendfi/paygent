import { Week2Console } from "@/components/week2-console";

export default function Home() {
  const weeklyPlan = [
    {
      week: "Week 1",
      title: "Foundation",
      tasks: [
        "Environment and secret contract",
        "MVP schema migration",
        "Health and service skeleton",
      ],
    },
    {
      week: "Week 2",
      title: "Onboarding + Funding",
      tasks: [
        "Create business and sub-account",
        "Supplier whitelist management",
        "Top-up links to sub-account",
      ],
    },
    {
      week: "Week 3",
      title: "Policy Engine",
      tasks: [
        "Per-tx and daily cap enforcement",
        "Active windows and reason codes",
        "Maker-checker thresholds",
      ],
    },
    {
      week: "Week 4",
      title: "Execution",
      tasks: [
        "Payout intent creation",
        "Approval and queue handoff",
        "ZendFi withdraw-bank path",
      ],
    },
    {
      week: "Week 5",
      title: "Reconciliation",
      tasks: [
        "Webhook ingestion and dedupe",
        "Retry policy for transient failures",
        "Owner payout notifications",
      ],
    },
    {
      week: "Week 6",
      title: "AI Agent Core",
      tasks: [
        "Intent parsing from owner commands",
        "Safe-launch mode for first payouts",
        "Readable decision reasoning",
      ],
    },
    {
      week: "Week 7",
      title: "Hardening",
      tasks: [
        "Freeze and unfreeze end-to-end",
        "Credential rotation monitoring",
        "SLA and failure dashboards",
      ],
    },
    {
      week: "Week 8",
      title: "Pilot Readiness",
      tasks: [
        "3-business UAT runbook",
        "Incident simulation",
        "KPI report and launch decision",
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-10">
      <section className="mx-auto w-full max-w-6xl">
        <p className="mb-2 inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-emerald-200">
          Paygent Execution Console
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          AI Supplier Payouts, Guardrail-First
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
          Monolithic Next.js build plan from week 1 to week 8. The execution order
          prioritizes trust controls first, then payout speed, then intelligent
          automation.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {weeklyPlan.map((item) => (
            <article
              key={item.week}
              className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5"
            >
              <p className="text-xs uppercase tracking-wider text-emerald-300">
                {item.week}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">{item.title}</h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                {item.tasks.map((task) => (
                  <li key={task}>- {task}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Week 8 Status</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Pilot readiness is now wired end-to-end. The console can run pilot checklists, incident
            simulations, KPI/post-mortem reporting, and launch recommendation analysis using live
            operational data from the same admin API surface.
          </p>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
              <p className="text-slate-400">Pilot Checklist</p>
              <p className="mt-1 font-medium text-emerald-300">3-Business Readiness Validation Live</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
              <p className="text-slate-400">Simulation + KPI</p>
              <p className="mt-1 font-medium text-emerald-300">Incident Drill and Post-Mortem Report Live</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
              <p className="text-slate-400">Launch Decision</p>
              <p className="mt-1 font-medium text-emerald-300">Go / Conditional / No-Go Recommendation Live</p>
            </div>
          </div>
        </section>

        <Week2Console />
      </section>
    </main>
  );
}
