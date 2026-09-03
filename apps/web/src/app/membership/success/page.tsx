"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { membershipApi, type Payment } from "@/lib/api";
import { useMe } from "@/lib/useMe";

export default function SuccessPage() {
  const router = useRouter();
  const { me, loading, refresh } = useMe();
  const [payment, setPayment] = useState<Payment | null>(null);

  useEffect(() => {
    if (!loading && !me) router.push("/sign-in");
  }, [loading, me, router]);

  useEffect(() => {
    if (!me) return;
    membershipApi.status().then(({ latest_payment }) => setPayment(latest_payment));
    // Membership just activated server-side (this is the success page) — the
    // shared `me` context was fetched once at app load and won't otherwise
    // pick up the new membership_status until a hard reload.
    refresh();
  }, [me, refresh]);

  if (loading || !me) return null;

  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14">
      <div className="w-full max-w-105 animate-[rise_0.45s_ease_both] text-center">
        <div className="mx-auto grid h-16 w-16 animate-[glow_2.4s_ease-in-out_infinite] place-items-center rounded-full border border-accent-dim bg-accent/10 font-mono text-2xl text-navy">
          ✓
        </div>
        <div className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.18em] text-navy">payment received</div>
        <h1 className="mt-3.5 text-[clamp(26px,3.6vw,34px)] leading-[1.15] tracking-[-0.03em]">
          KSh {payment ? Math.round(payment.amount) : "…"} confirmed
        </h1>

        {payment && (
          <div className="mt-6.5 rounded-[10px] border border-border bg-surface p-4.5 text-left font-mono text-xs">
            <Row label="receipt" value={payment.mpesa_receipt ?? "—"} />
            <Row label="amount" value={`KSh ${payment.amount.toFixed(2)}`} />
            <Row label="phone" value={`+${payment.phone}`} />
            <Row label="status" value="completed" accent />
          </div>
        )}

        <p className="mt-5.5 text-[15.5px] leading-[1.55] text-[#7a7060]">
          You&apos;re officially a member of MUT Tech Community. Welcome in.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-6 w-full rounded-lg bg-accent py-4 text-[15.5px] font-semibold text-[#1a2744] hover:opacity-90"
        >
          Continue
        </button>
      </div>
    </main>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-faint">{label}</span>
      <span className={accent ? "text-navy" : "text-foreground"}>{value}</span>
    </div>
  );
}
