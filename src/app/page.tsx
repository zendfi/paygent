import { PaymentsConsole } from "@/components/payments-console";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 sm:px-10 lg:px-12">
      <section className="mx-auto w-full max-w-7xl rounded-3xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8 lg:p-10">
        <p className="mb-3 inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-emerald-200">
          Paygent Console
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Business payouts made simple
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
          Set up your business, pay suppliers, and manage controls from one clear dashboard built
          for daily operations.
        </p>

        <PaymentsConsole />
      </section>
    </main>
  );
}
