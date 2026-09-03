"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { adminApi, type AdminCapstoneRow } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  pending: "text-warn",
  approved: "text-navy",
  rejected: "text-danger",
};

export default function CapstoneSubmissionsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [rows, setRows] = useState<AdminCapstoneRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminApi.listCapstoneSubmissions(slug).then((result) => {
      if (active) setRows(result);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  async function review(id: string, approve: boolean) {
    setBusy(id);
    try {
      const updated = await adminApi.reviewCapstoneSubmission(id, approve);
      setRows((r) => r?.map((row) => (row.id === id ? updated : row)) ?? null);
    } finally {
      setBusy(null);
    }
  }

  if (!rows) return null;

  return (
    <div className="max-w-160">
      <Link href={`/admin/courses/${slug}/edit`} className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted hover:text-navy">
        ← back to course
      </Link>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Capstone submissions</h1>

      <div className="mt-6 flex flex-col gap-3.5">
        {rows.length === 0 && (
          <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center text-sm text-muted">
            No submissions yet.
          </div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-[15px] font-semibold">{r.who}</span>
              <span className={`font-mono text-[10.5px] uppercase tracking-[0.1em] ${STATUS_COLOR[r.review_status] ?? "text-muted"}`}>
                {r.review_status}
              </span>
              {r.reviewed_by && <span className="font-mono text-[10.5px] text-faint">by {r.reviewed_by}</span>}
            </div>
            <a
              href={r.github_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[13.5px] text-navy hover:underline"
            >
              {r.github_url}
            </a>
            <p className="mt-2.5 text-[14.5px] leading-[1.55] text-muted">{r.what_built}</p>
            <div className="mt-4.5 flex flex-wrap gap-2">
              <button
                onClick={() => review(r.id, true)}
                disabled={busy === r.id}
                className="rounded-md border border-accent-dim px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-navy disabled:opacity-50"
              >
                approve
              </button>
              <button
                onClick={() => review(r.id, false)}
                disabled={busy === r.id}
                className="rounded-md border border-[#f6d9d6] px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-danger disabled:opacity-50"
              >
                reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
