"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, membershipApi } from "@/lib/api";
import { membershipFeeKes } from "@/lib/data";
import { useMe } from "@/lib/useMe";
import { signInHref } from "@/lib/nextParam";

export default function PayPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !me) router.push(signInHref("/membership/pay"));
  }, [loading, me, router]);

  if (loading || !me) return null;

  async function sendRequest() {
    setSubmitting(true);
    setError(null);
    try {
      await membershipApi.activate(`254${phone.replace(/\D/g, "")}`);
      router.push("/membership/waiting");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach M-Pesa — try again.");
      setSubmitting(false);
    }
  }

  const digits = phone.replace(/\D/g, "");
  const valid = digits.length === 9;

  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14 sm:px-8">
      <div className="w-full max-w-105">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-navy">step 02 of 02 · payment</div>
        <h1 className="mt-4 text-[clamp(28px,4vw,38px)] leading-[1.05] tracking-[-0.035em]">Pay with M-Pesa</h1>
        <p className="mt-3 mb-7 text-[15.5px] leading-[1.55] text-[#7a7060]">
          We&apos;ll send a payment request to your phone. You approve it there — never here.
        </p>

        <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">phone number</label>
        <div className="flex gap-2">
          <div className="grid place-items-center rounded-lg border border-border-strong bg-surface px-3.5 font-mono text-sm text-muted">
            +254
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="712 345 678"
            className="flex-1 rounded-lg border border-border-strong bg-surface px-3.5 py-3 font-mono text-[15px] tracking-wide text-foreground outline-none focus:border-accent"
          />
        </div>

        <div className="mt-6.5 flex items-baseline justify-between border-t border-border pt-5.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">amount</span>
          <span className="font-mono text-2xl font-bold">KSh {membershipFeeKes}</span>
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <button
          onClick={sendRequest}
          disabled={!valid || submitting}
          className="mt-5.5 w-full rounded-lg bg-accent py-4 text-[15.5px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send Payment Request"}
        </button>
        <div className="mt-4 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          secured by safaricom stk push
        </div>
      </div>
    </main>
  );
}
