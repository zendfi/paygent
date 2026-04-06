"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type AuthMode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const pageTitle = useMemo(
    () => (mode === "login" ? "Welcome back" : "Create your owner account"),
    [mode],
  );

  const checkSession = useCallback(async () => {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const data = (await response.json()) as {
      authenticated?: boolean;
      session?: { email?: string } | null;
    };

    setIsAuthenticated(Boolean(data.authenticated));
    if (data.session?.email) {
      setEmail(data.session.email);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLoading(true);
      setError("");
      setMessage("");

      try {
        if (!email.trim() || !password.trim()) {
          setError("Email and password are required.");
          return;
        }

        if (mode === "signup") {
          const registerResponse = await fetch("/api/auth/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: email.trim().toLowerCase(),
              password,
            }),
          });

          const registerData = (await registerResponse.json()) as {
            message?: string;
            error?: string;
          };

          if (!registerResponse.ok) {
            setError(registerData.message ?? "Could not create account.");
            return;
          }

          setMessage("Account created. You can sign in now.");
          setMode("login");
          setPassword("");
          return;
        }

        const loginResponse = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        });

        const loginData = (await loginResponse.json()) as {
          message?: string;
          session?: { email?: string };
        };

        if (!loginResponse.ok) {
          setError(loginData.message ?? "Sign in failed.");
          return;
        }

        setMessage("Sign in successful. Redirecting to dashboard...");
        setIsAuthenticated(true);
        setPassword("");
        if (loginData.session?.email) {
          setEmail(loginData.session.email);
        }
        router.push("/");
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [email, mode, password, router],
  );

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-10">
      <section className="mx-auto w-full max-w-5xl rounded-3xl border border-slate-700 bg-slate-900/70 p-6 sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-emerald-200">
              Paygent Access
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {pageTitle}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Simple owner login for day-to-day payouts. Use this page once, then run your business
              from the main dashboard.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
              {mode === "login" ? "Sign in" : "Sign up"}
            </p>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              placeholder="owner@company.com"
              required
            />

            <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              placeholder="Minimum 8 characters"
              minLength={8}
              required
            />

            {error ? (
              <p className="mt-4 rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="mt-4 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setPassword("");
                setError("");
                setMessage("");
              }}
              className="mt-3 w-full rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200"
            >
              {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
            </button>
          </form>

          <aside className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
              Session status
            </p>
            <p className="mt-3 text-sm text-slate-300">
              {isAuthenticated
                ? `Signed in as ${email}`
                : "Not signed in yet. Use the form to continue."}
            </p>
            <p className="mt-5 text-xs leading-6 text-slate-400">
              Protected actions in the dashboard require either an owner session or a valid bearer
              token. This flow stores a secure owner session cookie after sign in.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
