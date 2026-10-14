"use client";

import { FormEvent, useMemo, useState } from "react";
import { requestApi } from "../lib/api";

function getTokenFromQuery(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  return url.searchParams.get("token") ?? "";
}

export default function OwnerSetupPage() {
  const initialToken = useMemo(() => getTokenFromQuery(), []);
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setResultMessage(null);
    setErrorMessage(null);

    try {
      await requestApi<{ completed: true }>("/auth/owner-setup", {
        method: "POST",
        body: JSON.stringify({
          token: token.trim(),
          password,
        }),
      });

      setResultMessage(
        "Account setup completed. You can now sign in; platform operators enter the platform dashboard, and invited organization owners enter their organization's dashboard.",
      );
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Owner setup failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 text-zinc-900">
      <main className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Complete account setup</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Use the secure link sent to your email to set a password. This flow is used both for the platform operator's first account and for invited customer-organization owners.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Setup token</span>
            <input
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-black focus:ring-2"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              minLength={43}
              maxLength={43}
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">New password</span>
            <input
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-black focus:ring-2"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              maxLength={128}
              required
            />
          </label>

          {resultMessage ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {resultMessage}
            </p>
          ) : null}
          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <button
            className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Complete owner setup"}
          </button>
        </form>

        <a className="mt-5 inline-block text-xs text-zinc-600 underline" href="/login">
          Back to login
        </a>
      </main>
    </div>
  );
}
