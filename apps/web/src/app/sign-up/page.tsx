"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi, ApiError } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { GoogleIcon } from "@/components/icons";

export default function SignUpPage() {
  const router = useRouter();
  const { refresh } = useMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authApi.signup(email, password);
      await refresh();
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 font-mono text-[11px] uppercase tracking-[0.14em] text-navy">
          ● join the builders
        </div>
        <h1 className="mb-8 text-[clamp(28px,4vw,40px)] leading-[1.05] font-bold tracking-[-0.035em]">
          Create your account.
        </h1>

        <a
          href={authApi.googleStartUrl()}
          className="mb-6 flex w-full items-center justify-center gap-2.5 rounded-md border border-border-strong bg-surface px-4 py-3 text-sm text-foreground transition hover:border-accent-dim"
        >
          <GoogleIcon />
          Continue with Google
        </a>

        <div className="mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          <span className="h-px flex-1 bg-border-strong" />
          or
          <span className="h-px flex-1 bg-border-strong" />
        </div>

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
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Password</span>
            <input
              type="password"
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-md bg-accent px-4 py-3 text-sm font-medium text-[#1a2744] transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-navy hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
