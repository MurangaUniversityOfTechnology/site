"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { membershipFeeKes, membershipPerks } from "@/lib/data";
import { useMe } from "@/lib/useMe";
import { signInHref } from "@/lib/nextParam";

export default function ActivateReviewPage() {
  const router = useRouter();
  const { me, loading } = useMe();

  useEffect(() => {
    if (!loading && !me) router.push(signInHref("/membership/activate"));
  }, [loading, me, router]);

  if (loading || !me) return null;

  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14 sm:px-8">
      <div className="w-full max-w-120">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-navy">step 01 of 02 · review</div>
        <h1 className="mt-4 text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.035em]">Activate membership</h1>

        <div className="mt-7 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-start justify-between gap-4 border-b border-[#ddd6c4] p-5.5">
            <div>
              <div className="text-[17px] font-semibold">2026 Club Membership</div>
              <div className="mt-1.5 font-mono text-[11px] text-faint">24 Aug 2026 — 23 Aug 2027</div>
            </div>
            <div className="whitespace-nowrap font-mono text-[22px] font-bold">KSh {membershipFeeKes}</div>
          </div>
          <div className="grid grid-cols-1 gap-2.5 p-5.5 sm:grid-cols-2">
            {membershipPerks.map((perk) => (
              <div key={perk} className="flex items-baseline gap-2.5 text-[14.5px] text-[#33302b]">
                <span className="font-mono text-xs text-navy">✓</span>
                {perk}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => router.push("/membership/pay")}
          className="mt-6 w-full rounded-lg bg-accent py-4 text-[15.5px] font-semibold text-[#1a2744] hover:opacity-90"
        >
          Continue to Payment
        </button>
        <div className="mt-4 text-center font-mono text-[10.5px] leading-[1.7] text-[#9c8d70]">
          membership activates instantly once payment is confirmed
        </div>
      </div>
    </main>
  );
}
