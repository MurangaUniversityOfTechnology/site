"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { membershipFeeKes } from "@/lib/data";
import { useMe } from "@/lib/useMe";

export default function RenewPage() {
  const router = useRouter();
  const { me, loading } = useMe();

  useEffect(() => {
    if (!loading && !me) router.push("/sign-in");
  }, [loading, me, router]);

  if (loading || !me) return null;

  const status = me.membership_status;
  const isExpired = status === "expired" || status === "suspended";
  const isActive = status === "active";

  const accent = isExpired ? "text-danger" : "text-navy";
  const dot = isExpired ? "bg-danger" : "bg-accent";
  const tag = isExpired ? "membership expired" : isActive ? "membership active" : "membership";
  const title = isExpired ? "Your membership lapsed" : isActive ? "You're all set" : "No active membership";
  const body = isExpired
    ? "No worries — renewing puts you right back in the same review pipeline as any new payment."
    : isActive
      ? "Everything's current. There's nothing to renew yet."
      : "You don't have a membership to renew. Activate one from your dashboard instead.";

  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14">
      <div className="w-full max-w-115">
        <div className={`flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] ${accent}`}>
          <span className={`h-1.5 w-1.5 animate-[pulse_1.8s_infinite] rounded-full ${dot}`} />
          {tag}
        </div>
        <h1 className="mt-4.5 text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.035em]">{title}</h1>
        <p className="mt-3.5 text-base leading-[1.6] text-[#7a7060]">{body}</p>

        <div className="mt-7 rounded-xl border border-border bg-surface p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">what you keep either way</div>
          <p className="mt-2.5 text-[14.5px] leading-[1.6] text-muted">
            Your profile, projects, credentials and everything you shipped stay yours and stay public. Lapsing
            removes participation, never history.
          </p>
        </div>

        {isExpired && (
          <button
            onClick={() => router.push("/membership/pay")}
            className="mt-6.5 rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
          >
            Renew for KSh {membershipFeeKes}
          </button>
        )}
      </div>
    </main>
  );
}
