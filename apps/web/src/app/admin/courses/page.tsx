"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, adminApi, type AdminCourseRow } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";

type Tab = "draft" | "published" | "archived";

export default function AdminCoursesPage() {
  const [tab, setTab] = useState<Tab>("draft");
  const [rows, setRows] = useState<AdminCourseRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    let active = true;
    adminApi.listCourses(tab === "archived").then((result) => {
      if (active) setRows(result);
    });
    return () => {
      active = false;
    };
  }, [tab]);

  const visible = rows?.filter((c) => {
    if (tab === "archived") return true;
    if (tab === "draft") return !c.published_at;
    return !!c.published_at;
  });

  async function remove(slug: string, title: string) {
    const ok = await confirm({
      title: "Delete course?",
      message: `"${title}" will be permanently deleted. This only works if no one has enrolled yet.`,
    });
    if (!ok) return;
    setBusy(slug);
    setError(null);
    try {
      await adminApi.deleteCourse(slug);
      setRows((r) => r?.filter((c) => c.slug !== slug) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete course.");
    } finally {
      setBusy(null);
    }
  }

  async function archive(slug: string) {
    setBusy(slug);
    setError(null);
    try {
      await adminApi.archiveCourse(slug);
      setRows((r) => r?.filter((c) => c.slug !== slug) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't archive course.");
    } finally {
      setBusy(null);
    }
  }

  async function unarchive(slug: string) {
    setBusy(slug);
    setError(null);
    try {
      await adminApi.unarchiveCourse(slug);
      setRows((r) => r?.filter((c) => c.slug !== slug) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't unarchive course.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">courses</div>
          <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Manage courses</h1>
        </div>
        <Link
          href="/admin/courses/new"
          className="rounded-md bg-accent px-4.5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744] hover:opacity-90"
        >
          New course
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
          No {tab} courses.
        </div>
      )}

      <div className="mt-6.5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible?.map((c) => (
          <div key={c.slug} className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
            {c.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.cover_image_url} alt="" className="h-32 w-full object-cover" />
            ) : (
              <div className="grid h-32 w-full place-items-center bg-[linear-gradient(150deg,#fbf3df,#f5e6bf)] font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy/40">
                no cover image
              </div>
            )}

            <div className="flex flex-1 flex-col p-4.5">
              <div className="text-[15px] font-medium leading-[1.35]">{c.title}</div>
              {c.short_description && (
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.5] text-muted">{c.short_description}</p>
              )}
              <div className="mt-2.5 font-mono text-[10px] text-faint">by {c.created_by}</div>

              {c.arms.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.arms.map((a) => (
                    <span
                      key={a.id}
                      className="rounded-md border border-border-strong px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-muted"
                    >
                      {a.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10.5px] text-muted">
                <span>
                  {c.module_count} module{c.module_count === 1 ? "" : "s"}
                </span>
                <span>{c.price_kes === 0 ? "free" : `KSh ${c.price_kes}`}</span>
                <span>{c.enrollment_count} enrolled</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {tab !== "archived" ? (
                  <>
                    <Link
                      href={`/admin/courses/${c.slug}/edit`}
                      className="rounded-md bg-accent px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#1a2744]"
                    >
                      manage course
                    </Link>
                    <button
                      onClick={() => archive(c.slug)}
                      disabled={busy === c.slug}
                      className="rounded-md border border-border-strong px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted disabled:opacity-50"
                    >
                      archive
                    </button>
                    <button
                      onClick={() => remove(c.slug, c.title)}
                      disabled={busy === c.slug}
                      className="rounded-md border border-[#f6d9d6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-danger disabled:opacity-50"
                    >
                      delete
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => unarchive(c.slug)}
                    disabled={busy === c.slug}
                    className="rounded-md bg-accent px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#1a2744] disabled:opacity-50"
                  >
                    unarchive
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
