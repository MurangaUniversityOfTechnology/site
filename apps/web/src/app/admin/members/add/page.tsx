"use client";

import { useState } from "react";
import Link from "next/link";
import { ApiError, adminApi, type AddMemberResponse } from "@/lib/api";

const REASONS = ["Sponsor / partner", "Committee member", "Speaker", "Migrated from legacy list", "Other"];

type Activation = "active" | "stk_push" | "manual_receipt";

export default function AddMemberPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [githubHandle, setGithubHandle] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [activation, setActivation] = useState<Activation>("active");
  const [phone, setPhone] = useState("");
  const [mpesaReceipt, setMpesaReceipt] = useState("");
  const [amountKes, setAmountKes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AddMemberResponse | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setResult(null);
    setDisplayName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setRegistrationNumber("");
    setGithubHandle("");
    setReason(REASONS[0]);
    setActivation("active");
    setPhone("");
    setMpesaReceipt("");
    setAmountKes("");
    setCopied(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi.addMember({
        email: email.trim(),
        display_name: displayName.trim(),
        registration_number: registrationNumber.trim() || null,
        github_handle: githubHandle.trim() || null,
        reason,
        password: password.trim() || null,
        activation,
        phone: activation !== "active" ? phone.trim() || null : null,
        mpesa_receipt: activation === "manual_receipt" ? mpesaReceipt.trim() || null : null,
        amount_kes: activation === "manual_receipt" && amountKes.trim() ? Number(amountKes) : null,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add member.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const pendingPayment = result.membership_status === "payment_pending";
    const recordedPayment = activation === "manual_receipt";
    return (
      <div className="max-w-130">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-navy">member added</div>
        <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">{result.email}</h1>

        {pendingPayment && (
          <div className="mt-6 rounded-xl border border-[#f0dfb8] bg-warn/[0.04] p-5.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-warn">m-pesa request sent</div>
            <p className="mt-3 text-[14.5px] leading-[1.55] text-[#7a7060]">
              An STK push went to {phone || "their phone"}. Membership activates automatically the moment they pay —
              nothing more for you to do here.
            </p>
          </div>
        )}

        {recordedPayment && !pendingPayment && (
          <div className="mt-6 rounded-xl border border-accent-dim bg-[linear-gradient(160deg,rgba(201,168,76,.05),transparent_60%)] p-5.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-navy">payment recorded</div>
            <p className="mt-3 text-[14.5px] leading-[1.55] text-[#7a7060]">
              Receipt <span className="font-mono text-foreground">{mpesaReceipt}</span> is on file for {phone}.
              Membership is active now.
            </p>
          </div>
        )}

        {!pendingPayment &&
          !recordedPayment &&
          (result.temp_password ? (
            <div className="mt-6 rounded-xl border border-accent-dim bg-[linear-gradient(160deg,rgba(201,168,76,.05),transparent_60%)] p-5.5">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                temporary password — shown once
              </div>
              <div className="mt-3 flex items-center gap-2.5">
                <code className="flex-1 rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-[15px] tracking-wide">
                  {result.temp_password}
                </code>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(result.temp_password ?? "");
                    setCopied(true);
                  }}
                  className="rounded-md border border-accent-dim px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-navy"
                >
                  {copied ? "copied" : "copy"}
                </button>
              </div>
              <p className="mt-3.5 text-[13.5px] leading-[1.55] text-muted">
                Share this with the member directly — it won&apos;t be shown again. They should change it after signing
                in.
              </p>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted">
              {password
                ? "Membership was granted using the password you set."
                : "This account already existed; membership was granted without changing their password."}
            </p>
          ))}

        <button onClick={reset} className="mt-6.5 rounded-lg border border-border-strong px-5.5 py-3 text-sm hover:border-accent-dim">
          Add another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-130">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">members</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Add a member</h1>
      <p className="mt-3.5 text-[14.5px] leading-[1.55] text-muted">
        Grant membership directly (sponsors, committee, migrated rosters), send a real M-Pesa request to their
        phone, or record a payment they already made in person (cash, or paid straight to a till). Adding a whole
        legacy list at once?{" "}
        <Link href="/admin/members/import" className="text-navy hover:underline">
          Import members in bulk →
        </Link>
      </p>

      <form onSubmit={submit} className="mt-6.5 flex flex-col gap-4.5">
        <Field label="Full name">
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Password (optional — auto-generated if left blank)">
          <div className="flex items-center gap-2">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="leave blank to auto-generate"
              minLength={8}
              className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="whitespace-nowrap rounded-md border border-border-strong px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted hover:border-accent-dim"
            >
              {showPassword ? "hide" : "show"}
            </button>
          </div>
        </Field>
        <Field label="Registration number (optional)">
          <input
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="GitHub handle (optional)">
          <input
            value={githubHandle}
            onChange={(e) => setGithubHandle(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </Field>

        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">reason</div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] ${
                  reason === r ? "border-accent-dim bg-accent/[0.08] text-navy" : "border-border-strong text-muted"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">how do they activate?</div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActivation("active")}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] ${
                activation === "active" ? "border-accent-dim bg-accent/[0.08] text-navy" : "border-border-strong text-muted"
              }`}
            >
              Activate immediately (free)
            </button>
            <button
              type="button"
              onClick={() => setActivation("stk_push")}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] ${
                activation === "stk_push" ? "border-accent-dim bg-accent/[0.08] text-navy" : "border-border-strong text-muted"
              }`}
            >
              Send M-Pesa request
            </button>
            <button
              type="button"
              onClick={() => setActivation("manual_receipt")}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] ${
                activation === "manual_receipt" ? "border-accent-dim bg-accent/[0.08] text-navy" : "border-border-strong text-muted"
              }`}
            >
              Record a payment already made
            </button>
          </div>
        </div>

        {activation === "stk_push" && (
          <Field label="Phone number">
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712 345 678"
              className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
            />
          </Field>
        )}

        {activation === "manual_receipt" && (
          <>
            <Field label="Phone number the payment came from">
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
                className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
              />
            </Field>
            <Field label="M-Pesa receipt code">
              <input
                required
                value={mpesaReceipt}
                onChange={(e) => setMpesaReceipt(e.target.value.toUpperCase())}
                placeholder="QWE1RTY2UI"
                className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
              />
            </Field>
            <Field label="Amount received (optional — defaults to the membership fee)">
              <input
                type="number"
                min={1}
                value={amountKes}
                onChange={(e) => setAmountKes(e.target.value)}
                placeholder="200"
                className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
              />
            </Field>
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 w-fit rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
        >
          {busy
            ? "Adding…"
            : activation === "stk_push"
              ? "Add & send M-Pesa request"
              : activation === "manual_receipt"
                ? "Add & record payment"
                : "Add member"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{label}</div>
      <div className="mt-2">{children}</div>
    </label>
  );
}
