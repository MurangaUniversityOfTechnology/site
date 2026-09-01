"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi, ApiError } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (!token) {
      setError("This reset link is missing its token.");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, new_password: password });
      setDone(true);
      setTimeout(() => router.push("/sign-in"), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-[clamp(28px,4vw,38px)] leading-[1.05] font-bold tracking-[-0.035em]">
          Set a new password
        </h1>

        {!token ? (
          <p className="text-sm text-danger">
            This link is missing its token — copy it again from the email, or{" "}
            <Link href="/forgot-password" className="text-navy hover:underline">
              request a new one
            </Link>
            .
          </p>
        ) : done ? (
          <p className="text-[15px] leading-[1.6] text-muted">Password updated — taking you to sign in…</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">New password</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Confirm password</span>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded-md bg-accent px-4 py-3 text-sm font-medium text-[#1a2744] transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
