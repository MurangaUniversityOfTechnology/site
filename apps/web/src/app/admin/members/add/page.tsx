"use client";

import { useState } from "react";
import { ApiError, adminExtraApi, type AddMemberResponse } from "@/lib/api";

const REASONS = ["Sponsor / partner", "Committee member", "Speaker", "Migrated from legacy list", "Other"];

export default function AddMemberPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [githubHandle, setGithubHandle] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AddMemberResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await adminExtraApi.addMember({
        email: email.trim(),
        display_name: displayName.trim(),
        registration_number: registrationNumber.trim() || null,
        github_handle: githubHandle.trim() || null,
        reason,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add member.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-130">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent">member added</div>
        <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">{result.email}</h1>

        {result.temp_password ? (
          <div className="mt-6 rounded-xl border border-accent-dim bg-[linear-gradient(160deg,rgba(61,250,138,.05),transparent_60%)] p-5.5">
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
                className="rounded-md border border-accent-dim px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-accent"
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
            This account already existed; membership was granted without changing their password.
          </p>
        )}

        <button
          onClick={() => {
            setResult(null);
            setDisplayName("");
            setEmail("");
            setRegistrationNumber("");
            setGithubHandle("");
            setReason(REASONS[0]);
            setCopied(false);
          }}
          className="mt-6.5 rounded-lg border border-border-strong px-5.5 py-3 text-sm hover:border-accent-dim"
        >
          Add another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-130">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">members</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Add without payment</h1>
      <p className="mt-3.5 text-[14.5px] leading-[1.55] text-muted">
        Grants active membership directly, bypassing M-Pesa. Use for sponsors, committee members, or migrating an
        existing roster.
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
        <Field label="Registration number (optional)">
          <input
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="GitHub handle (optional)">
          <input
            value={githubHandle}
            onChange={(e) => setGithubHandle(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
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
                  reason === r ? "border-accent-dim bg-accent/[0.08] text-accent" : "border-border-strong text-muted"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 w-fit rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#04140b] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add member"}
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
