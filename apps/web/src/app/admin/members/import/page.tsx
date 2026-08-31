"use client";

import { useState } from "react";
import { ApiError, adminApi, type ImportMemberRow, type ImportMembersResponse } from "@/lib/api";

const PLACEHOLDER = `Amina Wanjiku, amina@students.mut.ac.ke
Brian Otieno, brian@students.mut.ac.ke, SC212/1188/2022`;

function parseRows(text: string): { rows: ImportMemberRow[]; malformed: string[] } {
  const rows: ImportMemberRow[] = [];
  const malformed: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(",").map((p) => p.trim());
    const [display_name, email, registration_number] = parts;
    if (!display_name || !email || !email.includes("@")) {
      malformed.push(rawLine);
      continue;
    }
    rows.push({ display_name, email, registration_number: registration_number || null });
  }
  return { rows, malformed };
}

export default function ImportMembersPage() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportMembersResponse | null>(null);

  const { rows, malformed } = parseRows(text);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rows.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await adminApi.importMembers(rows);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't import members.");
    } finally {
      setBusy(false);
    }
  }

  const created = result?.results.filter((r) => r.status === "created").length ?? 0;
  const failed = result?.results.filter((r) => r.status === "error").length ?? 0;

  return (
    <div className="max-w-160">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">members</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Import members</h1>
      <p className="mt-3.5 text-[14.5px] leading-[1.55] text-muted">
        For a legacy list of members who already paid outside the app — each row gets an active account with an
        auto-generated password, emailed to them directly so they can sign in without paying again. They can change
        it later from Settings.
      </p>

      <form onSubmit={submit} className="mt-6.5">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          one per line — name, email, registration number (optional)
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={10}
          className="mt-2 w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-[13px] leading-[1.6] outline-none focus:border-accent"
        />

        <div className="mt-2.5 flex flex-wrap gap-4 font-mono text-[11px] text-muted">
          <span>{rows.length} ready</span>
          {malformed.length > 0 && <span className="text-danger">{malformed.length} malformed (need name, email)</span>}
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={busy || rows.length === 0}
          className="mt-4 w-fit rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Importing…" : `Import ${rows.length || ""} member${rows.length === 1 ? "" : "s"}`}
        </button>
      </form>

      {result && (
        <div className="mt-7">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
            {created} created · {failed} failed
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
            {result.results.map((r, i) => (
              <div key={i} className="flex items-center gap-3.5 border-b border-[#e8e1d2] px-4.5 py-3 last:border-0">
                <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{r.email}</span>
                {r.status === "created" ? (
                  <span className="whitespace-nowrap rounded-md border border-accent-dim px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-navy">
                    created
                  </span>
                ) : (
                  <span className="whitespace-nowrap text-[13px] text-danger">{r.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
