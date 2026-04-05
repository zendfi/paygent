import { PaymentsConsole } from "@/components/payments-console";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-10">
      <section className="mx-auto w-full max-w-7xl">
        <p className="mb-2 inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-emerald-200">
          Paygent Console
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          AI Supplier Payouts, Guardrail-First
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
          Manage onboarding, policy controls, payout execution, operations, and launch readiness
          from a single operator interface.
        </p>

        <PaymentsConsole />
      </section>
    </main>
  );
}
