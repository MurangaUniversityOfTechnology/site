"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, donationApi, type DonationReason, type DonationWallEntry } from "@/lib/api";
import { donationMinKes, donationPresetAmountsKes, donationReasons } from "@/lib/data";

const reasonLabel = (r: string) => donationReasons.find((d) => d.value === r)?.label ?? r;

export default function DonatePage() {
  const router = useRouter();
  const [amount, setAmount] = useState<number | null>(donationPresetAmountsKes[1]);
  const [customAmount, setCustomAmount] = useState("");
  const [reason, setReason] = useState<DonationReason>("general");
  const [donorName, setDonorName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wall, setWall] = useState<DonationWallEntry[] | null>(null);

  useEffect(() => {
    donationApi.wall().then(setWall).catch(() => setWall([]));
  }, []);

  const effectiveAmount = customAmount ? Number(customAmount.replace(/\D/g, "")) : amount;
  const digits = phone.replace(/\D/g, "");
  const validAmount = !!effectiveAmount && effectiveAmount >= donationMinKes;
  const validPhone = digits.length === 9;
  const valid = validAmount && validPhone;

  async function sendRequest() {
    if (!effectiveAmount) return;
    setSubmitting(true);
    setError(null);
    try {
      const donation = await donationApi.create({
        amount: effectiveAmount,
        phone: `254${digits}`,
        reason,
        donor_name: donorName.trim() || null,
        is_anonymous: anonymous,
        message: message.trim() || null,
      });
      router.push(`/donate/waiting?id=${donation.id}&amount=${effectiveAmount}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach M-Pesa — try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="px-5 py-14 sm:px-8">
      <div className="mx-auto grid max-w-260 gap-14 lg:grid-cols-[1fr_380px]">
        {/* Form */}
        <div className="mx-auto w-full max-w-105 lg:mx-0">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-navy">support the community</div>
          <h1 className="mt-4 text-[clamp(28px,4vw,38px)] leading-[1.05] tracking-[-0.035em]">Fuel what we build.</h1>
          <p className="mt-3 mb-7 text-[15.5px] leading-[1.55] text-[#7a7060]">
            Every shilling goes straight to events, workshops, and tools for students building things at MUT. No
            account needed.
          </p>

          <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">amount</label>
          <div className="grid grid-cols-3 gap-2">
            {donationPresetAmountsKes.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setAmount(a);
                  setCustomAmount("");
                }}
                className={`rounded-lg border py-3 font-mono text-[14.5px] transition-colors ${
                  amount === a && !customAmount
                    ? "border-accent bg-accent/10 text-navy"
                    : "border-border-strong bg-surface text-muted hover:border-accent-dim"
                }`}
              >
                {a}
              </button>
            ))}
            <input
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value.replace(/\D/g, ""));
                setAmount(null);
              }}
              placeholder="Custom"
              inputMode="numeric"
              className={`rounded-lg border px-3 py-3 text-center font-mono text-[14.5px] outline-none ${
                customAmount ? "border-accent bg-accent/10 text-navy" : "border-border-strong bg-surface text-foreground"
              } focus:border-accent`}
            />
          </div>

          <label className="mt-6 mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">reason</label>
          <div className="flex flex-wrap gap-2">
            {donationReasons.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={`rounded-full border px-3.5 py-2 text-[13px] transition-colors ${
                  reason === r.value
                    ? "border-accent bg-accent/10 text-navy"
                    : "border-border-strong bg-surface text-muted hover:border-accent-dim"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <label className="mt-6 mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            your name <span className="normal-case text-faint/70">(optional)</span>
          </label>
          <input
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            placeholder="How should we credit you?"
            maxLength={80}
            className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-3 text-[15px] text-foreground outline-none focus:border-accent"
          />
          <label className="mt-2.5 flex items-center gap-2 text-[13.5px] text-muted">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--accent)]"
            />
            Keep my name off the public wall of support
          </label>

          <label className="mt-6 mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            message <span className="normal-case text-faint/70">(optional)</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Say a word to the community..."
            maxLength={500}
            rows={3}
            className="w-full resize-none rounded-lg border border-border-strong bg-surface px-3.5 py-3 text-[15px] leading-[1.5] text-foreground outline-none focus:border-accent"
          />

          <label className="mt-6 mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">phone number</label>
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
            <span className="font-mono text-2xl font-bold">KSh {effectiveAmount || 0}</span>
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

        {/* Wall of support */}
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">wall of support</div>
          <h2 className="mt-2.5 text-[19px] tracking-[-0.02em]">Recent donors</h2>

          <div className="mt-5 flex flex-col gap-3">
            {wall === null &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-[10px] border border-border bg-surface" />
              ))}
            {wall?.length === 0 && (
              <div className="rounded-[10px] border border-dashed border-border-strong bg-surface p-5 text-[14px] text-muted">
                No donations yet — be the first to show up here.
              </div>
            )}
            {wall?.map((d, i) => (
              <div key={i} className="rounded-[10px] border border-border bg-surface p-4.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[14.5px] font-semibold text-foreground">
                    {d.donor_name ?? "Anonymous"}
                  </span>
                  <span className="flex-none font-mono text-[13px] text-navy">KSh {d.amount.toFixed(0)}</span>
                </div>
                <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint">
                  {reasonLabel(d.reason)}
                </div>
                {d.message && <p className="mt-2 text-[13.5px] leading-[1.5] text-muted">&ldquo;{d.message}&rdquo;</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
