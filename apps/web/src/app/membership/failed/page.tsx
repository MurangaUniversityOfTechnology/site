"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { membershipApi } from "@/lib/api";
import { useMe } from "@/lib/useMe";

export default function FailedPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.push("/sign-in");
  }, [loading, me, router]);

  useEffect(() => {
    if (!me) return;
    membershipApi.status().then(({ latest_payment }) => setCancelled(latest_payment?.status === "cancelled"));
  }, [me]);

  if (loading || !me) return null;

  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14">
      <div className="w-full max-w-105 animate-[rise_0.45s_ease_both] text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-[#5a3330] bg-danger/10 font-mono text-xl text-danger">
          !
        </div>
        <div className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.18em] text-danger">
          payment {cancelled ? "cancelled" : "failed"}
        </div>
        <h1 className="mt-3.5 text-[clamp(26px,3.6vw,34px)] leading-[1.15] tracking-[-0.03em]">
          Nothing was charged
        </h1>

        <div className="mt-6 rounded-[10px] border border-border bg-surface p-4.5 text-left">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">reason</div>
          <div className="mt-2.5 text-[15.5px] leading-[1.5] text-[#c8d2cc]">
            {cancelled
              ? "You didn't approve the request on your phone in time."
              : "The request timed out on your phone before it was approved."}
          </div>
        </div>

        <p className="mt-5.5 text-[15px] leading-[1.55] text-[#9aa6a0]">
          If you think money left your account, don&apos;t pay again — tell an admin and we&apos;ll check with M-Pesa.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push("/membership/pay")}
            className="flex-1 rounded-lg bg-accent py-3.5 text-[15px] font-semibold text-[#04140b] hover:opacity-90"
          >
            Try Again
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg border border-border-strong px-5 py-3.5 text-[15px] text-muted"
          >
            Later
          </button>
        </div>
      </div>
    </main>
  );
}
