"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi, ApiError } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { GoogleIcon } from "@/components/icons";
import PasswordInput from "@/components/PasswordInput";
import { isSafeNext, signUpHref } from "@/lib/nextParam";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const next = isSafeNext(rawNext) ? rawNext : null;
  const { me, loading, refresh } = useMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && me) router.push(me.onboarded ? next ?? "/dashboard" : "/onboarding");
  }, [loading, me, router, next]);

  if (loading || me) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNoAccount(false);
    setSubmitting(true);
    try {
      const me = await authApi.login(email.trim(), password);
      await refresh();
      router.push(me.onboarded ? next ?? "/dashboard" : "/onboarding");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNoAccount(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDevLogin() {
    setError(null);
    setSubmitting(true);
    try {
      await authApi.devLogin();
      await refresh();
      router.push("/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-[clamp(28px,4vw,38px)] leading-[1.05] font-bold tracking-[-0.035em]">
          Sign in
        </h1>

        <a
          href={authApi.googleStartUrl(next)}
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
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Password</span>
              <Link href="/forgot-password" className="text-[12.5px] text-muted hover:text-navy hover:underline">
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}
          {noAccount && (
            <p className="text-sm text-danger">
              We couldn&apos;t find an account for that email.{" "}
              <Link href={signUpHref(next)} className="underline hover:opacity-80">
                Create one?
              </Link>
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-md bg-accent px-4 py-3 text-sm font-medium text-[#1a2744] transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link href={signUpHref(next)} className="text-navy hover:underline">
            Join the club
          </Link>
        </p>

        {process.env.NODE_ENV === "development" && (
          <div className="mt-8 rounded-md border border-dashed border-[#f0dfb8] bg-warn/[0.04] p-3.5 text-center">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-warn">dev only</div>
            <button
              type="button"
              onClick={handleDevLogin}
              disabled={submitting}
              className="mt-2 w-full rounded-md border border-border-strong py-2 text-sm text-muted hover:border-accent-dim disabled:opacity-50"
            >
              Sign in as dummy admin
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
