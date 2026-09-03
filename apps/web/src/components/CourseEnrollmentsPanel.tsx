"use client";

import { useEffect, useState } from "react";
import { adminApi, type AdminEnrollmentDetail, type AdminEnrollmentRow } from "@/lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function CourseEnrollmentsPanel({ slug }: { slug: string }) {
  const [rows, setRows] = useState<AdminEnrollmentRow[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminEnrollmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let active = true;
    adminApi.listEnrollments(slug).then((result) => {
      if (active) setRows(result);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  async function toggleExpand(row: AdminEnrollmentRow) {
    if (expandedId === row.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(row.id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const result = await adminApi.getEnrollmentDetail(row.id);
      setDetail(result);
    } finally {
      setDetailLoading(false);
    }
  }

  if (!rows) return null;

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-6">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
        enrollments{rows.length > 0 ? ` (${rows.length})` : ""}
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No one has enrolled yet.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-border-strong bg-background">
              <button
                type="button"
                onClick={() => toggleExpand(r)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-left"
              >
                <div className="min-w-40 flex-1">
                  <div className="text-sm font-medium">{r.who}</div>
                  <div className="font-mono text-[10px] text-faint">
                    {r.email} · enrolled {formatDate(r.enrolled_at)}
                  </div>
                </div>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted">
                  {r.modules_completed}/{r.modules_total} modules
                </span>
                <span className={`font-mono text-[10.5px] uppercase tracking-[0.06em] ${r.final_exam_passed ? "text-navy" : "text-faint"}`}>
                  exam {r.final_exam_passed ? "✓" : "—"}
                </span>
                {r.capstone_status && (
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted">
                    capstone: {r.capstone_status.replace(/_/g, " ")}
                  </span>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] ${
                    r.completed_at ? "bg-accent/[0.12] text-navy" : "border border-border-strong text-faint"
                  }`}
                >
                  {r.completed_at ? "completed" : "in progress"}
                </span>
                <span className="font-mono text-[10px] text-faint">{expandedId === r.id ? "▲" : "▼"}</span>
              </button>

              {expandedId === r.id && (
                <div className="border-t border-border px-4 py-4">
                  {detailLoading && <p className="text-sm text-muted">Loading…</p>}
                  {detail && detail.id === r.id && (
                    <div className="flex flex-col gap-4.5">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">modules</div>
                        <div className="mt-2 flex flex-col gap-1.5">
                          {detail.modules.map((m) => (
                            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                              <span className={m.locked ? "text-faint" : "text-foreground"}>{m.title}</span>
                              <span className="font-mono text-[11px] text-muted">
                                {m.lessons_completed}/{m.lessons_total} lessons ·{" "}
                                {m.locked ? "locked" : m.quiz_passed ? "quiz ✓" : "quiz —"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">quiz attempts</div>
                        {detail.attempts.length === 0 ? (
                          <p className="mt-2 text-sm text-muted">No attempts yet.</p>
                        ) : (
                          <div className="mt-2 flex flex-col gap-1.5">
                            {detail.attempts.map((a, i) => (
                              <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                                <span>
                                  {a.quiz_title}{" "}
                                  <span className="font-mono text-[10px] text-faint">
                                    ({a.kind === "final_exam" ? "final exam" : "module quiz"})
                                  </span>
                                </span>
                                <span className={`font-mono text-[11px] ${a.passed ? "text-navy" : "text-danger"}`}>
                                  {a.score_pct.toFixed(0)}% {a.passed ? "passed" : "failed"} · {formatDateTime(a.created_at)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
