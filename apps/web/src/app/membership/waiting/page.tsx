"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { membershipApi } from "@/lib/api";
import { membershipFeeKes } from "@/lib/data";
import { useMe } from "@/lib/useMe";

const POLL_INTERVAL_MS = 3000;
const UNKNOWN_AFTER_MS = 60_000;

export default function WaitingPage() {
  const router = useRouter();
  const { me, loading, refresh } = useMe();
  const [elapsed, setElapsed] = useState(0);
  const [unknown, setUnknown] = useState(false);
  const startedAt = useRef<number | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const { latest_payment } = await membershipApi.status();
      if (!latest_payment) return;
      if (latest_payment.status === "completed") {
        await refresh();
        router.push("/membership/success");
      } else if (latest_payment.status === "failed" || latest_payment.status === "cancelled") {
        router.push("/membership/failed");
      }
    } catch {
      // transient network error — next poll tick will retry
    }
  }, [router, refresh]);

  useEffect(() => {
    if (!me) return;
    startedAt.current = Date.now();
    checkStatus();
    const poll = setInterval(checkStatus, POLL_INTERVAL_MS);
    const tick = setInterval(() => {
      const ms = Date.now() - (startedAt.current ?? Date.now());
      setElapsed(Math.floor(ms / 1000));
      if (ms >= UNKNOWN_AFTER_MS) setUnknown(true);
    }, 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [me, checkStatus]);

  useEffect(() => {
    if (!loading && !me) router.push("/sign-in");
  }, [loading, me, router]);

  if (loading || !me) return null;

  return (
    <main className="relative grid min-h-[calc(100vh-64px)] place-items-center overflow-hidden px-5 py-14">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-130 w-130 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,168,76,.06),transparent_62%)]" />

      <div className="relative max-w-100 text-center">
        {!unknown ? (
          <>
            <div className="relative mx-auto grid h-19.5 w-19.5 place-items-center rounded-full border border-[#e5ded0]">
              <div className="absolute -inset-px animate-spin rounded-full border-2 border-transparent border-t-accent" />
              <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#9c8d70]">stk</span>
            </div>
            <h1 className="mt-7.5 text-[clamp(26px,3.6vw,36px)] leading-[1.1] tracking-[-0.03em]">Check your phone</h1>
            <p className="mt-4 text-base leading-[1.6] text-[#33302b]">
              We&apos;ve sent an M-Pesa request to your phone.
            </p>
            <p className="mt-3 text-[15px] leading-[1.55] text-[#8f8368]">
              Enter your M-Pesa PIN on your phone to approve KSh {membershipFeeKes}.
            </p>
            <div className="mt-7.5 flex justify-center gap-2">
              {[0, 0.2, 0.4].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 animate-pulse rounded-full bg-accent"
                  style={{ animationDelay: `${delay}s` }}
                />
              ))}
            </div>
            <div className="mt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
              waiting for confirmation · {elapsed}s
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-[#f0dfb8] bg-warn/10 font-mono text-xl text-warn">
              ?
            </div>
            <div className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.18em] text-warn">
              payment status unknown
            </div>
            <h1 className="mt-3.5 text-[clamp(26px,3.6vw,34px)] leading-[1.15] tracking-[-0.03em]">
              We haven&apos;t heard back yet
            </h1>
            <p className="mt-5.5 text-[15.5px] leading-[1.55] text-[#7a7060]">
              We&apos;re still checking with M-Pesa. <strong className="text-foreground">Don&apos;t pay again</strong> —
              if the payment does go through, we&apos;ll pick it up automatically.
            </p>
            <button
              onClick={() => {
                setUnknown(false);
                startedAt.current = Date.now();
                setElapsed(0);
                checkStatus();
              }}
              className="mt-6 rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
            >
              Check Again
            </button>
          </>
        )}
      </div>
    </main>
  );
}
