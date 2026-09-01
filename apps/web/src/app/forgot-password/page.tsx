"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authApi, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="mb-3 text-[clamp(28px,4vw,38px)] leading-[1.05] font-bold tracking-[-0.035em]">
          Reset your password
        </h1>

        {sent ? (
          <p className="text-[15px] leading-[1.6] text-muted">
            If an account exists for <span className="text-foreground">{email.trim()}</span>, we&apos;ve sent a link
            to reset your password. It expires in an hour.
          </p>
        ) : (
          <>
            <p className="mb-6 text-[14.5px] leading-[1.55] text-muted">
              Enter the email on your account and we&apos;ll send you a link to set a new password.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
              </label>

              {error && <p className="text-sm text-danger">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 rounded-md bg-accent px-4 py-3 text-sm font-medium text-[#1a2744] transition hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-sm text-muted">
          <Link href="/sign-in" className="text-navy hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
