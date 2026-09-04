"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, adminApi, type AdminFormRow } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";

type Tab = "draft" | "published" | "archived";

export default function AdminFormsPage() {
  const [tab, setTab] = useState<Tab>("draft");
  const [rows, setRows] = useState<AdminFormRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    let active = true;
    adminApi.listForms(tab === "archived").then((result) => {
      if (active) setRows(result);
    });
    return () => {
      active = false;
    };
  }, [tab]);

  const visible = rows?.filter((f) => {
    if (tab === "archived") return true;
    if (tab === "draft") return !f.published_at;
    return !!f.published_at;
  });

  async function remove(slug: string, title: string) {
    const ok = await confirm({
      title: "Delete form?",
      message: `"${title}" will be permanently deleted. This only works if it has no responses yet.`,
    });
    if (!ok) return;
    setBusy(slug);
    setError(null);
    try {
      await adminApi.deleteForm(slug);
      setRows((r) => r?.filter((f) => f.slug !== slug) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete form.");
    } finally {
      setBusy(null);
    }
  }

  async function archive(slug: string) {
    setBusy(slug);
    setError(null);
    try {
      await adminApi.archiveForm(slug);
      setRows((r) => r?.filter((f) => f.slug !== slug) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't archive form.");
    } finally {
      setBusy(null);
    }
  }

  async function unarchive(slug: string) {
    setBusy(slug);
    setError(null);
    try {
      await adminApi.unarchiveForm(slug);
      setRows((r) => r?.filter((f) => f.slug !== slug) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't unarchive form.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">forms</div>
          <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Manage forms</h1>
        </div>
        <Link
          href="/admin/forms/new"
          className="rounded-md bg-accent px-4.5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744] hover:opacity-90"
        >
          New form
        </Link>
      </div>

      <div className="mt-5 flex gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em]">
        {(["draft", "published", "archived"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3.5 py-2 ${tab === t ? "bg-accent text-[#1a2744]" : "border border-border-strong text-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {visible?.length === 0 && (
        <div className="mt-6.5 rounded-[11px] border border-border bg-surface px-4.5 py-8 text-center text-sm text-muted">
          No {tab} forms.
        </div>
      )}

      <div className="mt-6.5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible?.map((f) => (
          <div key={f.slug} className="flex flex-col rounded-xl border border-border bg-surface p-4.5">
            <div className="text-[15px] font-medium leading-[1.35]">{f.title}</div>
            {f.description && <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.5] text-muted">{f.description}</p>}
            <div className="mt-2.5 font-mono text-[10px] text-faint">by {f.created_by}</div>

            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10.5px] text-muted">
              <span>
                {f.field_count} field{f.field_count === 1 ? "" : "s"}
              </span>
              <span>{f.response_count} response{f.response_count === 1 ? "" : "s"}</span>
              <span>{f.require_login ? "members only" : "anyone with the link"}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {tab !== "archived" ? (
                <>
                  <Link
                    href={`/admin/forms/${f.slug}/edit`}
                    className="rounded-md bg-accent px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#1a2744]"
                  >
                    manage form
                  </Link>
                  <Link
                    href={`/admin/forms/${f.slug}/responses`}
                    className="rounded-md border border-border-strong px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted"
                  >
                    responses
                  </Link>
                  <button
                    onClick={() => archive(f.slug)}
                    disabled={busy === f.slug}
                    className="rounded-md border border-border-strong px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted disabled:opacity-50"
                  >
                    archive
                  </button>
                  <button
                    onClick={() => remove(f.slug, f.title)}
                    disabled={busy === f.slug}
                    className="rounded-md border border-[#f6d9d6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-danger disabled:opacity-50"
                  >
                    delete
                  </button>
                </>
              ) : (
                <button
                  onClick={() => unarchive(f.slug)}
                  disabled={busy === f.slug}
                  className="rounded-md bg-accent px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#1a2744] disabled:opacity-50"
                >
                  unarchive
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
