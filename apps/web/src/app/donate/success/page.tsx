"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { donationApi, type Donation } from "@/lib/api";

const IMPACT_LINE: Record<Donation["reason"], string> = {
  alumni: "back into the community you came from",
  general: "straight into the next event, workshop, or tool for a student here",
  sponsorship: "straight into making the next event happen",
  scholarship: "straight into the scholarship / bursary fund",
  other: "straight into the community's work",
};

function SuccessContent() {
  const id = useSearchParams().get("id");
  const [donation, setDonation] = useState<Donation | null>(null);

  useEffect(() => {
    if (!id) return;
    donationApi.status(id).then(setDonation).catch(() => {});
  }, [id]);

  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14">
      <div className="w-full max-w-105 animate-[rise_0.45s_ease_both] text-center">
        <div className="mx-auto grid h-16 w-16 animate-[glow_1.8s_ease-in-out_2] place-items-center rounded-full border border-accent-dim bg-accent/10 font-mono text-2xl text-navy">
          ✓
        </div>
        <div className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.18em] text-navy">donation received</div>
        <h1 className="mt-3.5 text-[clamp(26px,3.6vw,34px)] leading-[1.15] tracking-[-0.03em]">
          {donation?.donor_name ? `Thank you, ${donation.donor_name}.` : "Thank you."}
        </h1>
        <p className="mt-2 text-[15.5px] text-[#8f8368]">
          KSh {donation ? Math.round(donation.amount) : "…"} confirmed
        </p>

        {donation?.message && (
          <p className="mt-5 text-[14.5px] leading-[1.55] text-muted">
            &ldquo;{donation.message}&rdquo;
          </p>
        )}

        {donation && (
          <div className="mt-6.5 rounded-[10px] border border-border bg-surface p-4.5 text-left font-mono text-xs">
            <Row label="receipt" value={donation.mpesa_receipt ?? "—"} />
            <Row label="amount" value={`KSh ${donation.amount.toFixed(2)}`} />
            <Row label="status" value="completed" accent />
          </div>
        )}

        <p className="mt-5.5 text-[15.5px] leading-[1.55] text-[#7a7060]">
          This goes {donation ? IMPACT_LINE[donation.reason] : "straight into the community's work"} — we&apos;re grateful
          you chose to back it.
        </p>
        <Link
          href="/"
          className="mt-6 block w-full rounded-lg bg-accent py-4 text-[15.5px] font-semibold text-[#1a2744] hover:opacity-90"
        >
          Back to Home
        </Link>
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

export default function DonateSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
