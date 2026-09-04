"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adminApi, type AdminFieldRow, type AdminResponsesPage, type FormAnswerItem } from "@/lib/api";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const CHOICE_TYPES = new Set(["single_choice", "multi_choice", "dropdown"]);

function formatAnswer(field: AdminFieldRow | undefined, answer: FormAnswerItem | undefined): string {
  if (!field || !answer || answer.value == null || answer.value === "") return "—";
  if (field.type === "yes_no") return answer.value ? "Yes" : "No";
  if (CHOICE_TYPES.has(field.type)) {
    const ids = Array.isArray(answer.value) ? answer.value : [answer.value];
    const labels = field.choices.map((c) => (ids.includes(c.id) ? c.text : null)).filter(Boolean);
    return labels.length > 0 ? labels.join(", ") : "—";
  }
  return String(answer.value);
}

export default function FormResponsesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [fields, setFields] = useState<AdminFieldRow[] | null>(null);
  const [page, setPage] = useState<AdminResponsesPage | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([adminApi.listFormFields(slug), adminApi.listFormResponses(slug)]).then(([f, p]) => {
      if (active) {
        setFields(f);
        setPage(p);
      }
    });
    return () => {
      active = false;
    };
  }, [slug]);

  if (!fields || !page) return null;

  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const choiceFields = fields.filter((f) => CHOICE_TYPES.has(f.type));

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">forms</div>
          <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">
            Responses ({page.responses.length})
          </h1>
        </div>
        <a
          href={adminApi.exportFormResponsesUrl(slug)}
          className="rounded-md border border-border-strong px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted"
        >
          export csv
        </a>
      </div>

      {choiceFields.length > 0 && (
        <div className="mt-6.5 flex flex-col gap-4">
          {choiceFields.map((f) => {
            const counts = page.tallies[f.id] ?? {};
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            return (
              <div key={f.id} className="rounded-xl border border-border bg-surface p-5">
                <div className="text-[14px] font-medium">{f.prompt}</div>
                <div className="mt-3 flex flex-col gap-2">
                  {f.choices.map((c) => {
                    const count = counts[c.id] ?? 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={c.id} className="flex items-center gap-3">
                        <span className="w-28 flex-none truncate text-[13px] text-muted">{c.text}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-10 flex-none text-right font-mono text-[11px] text-faint">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6.5 flex flex-col gap-2">
        {page.responses.length === 0 && (
          <div className="rounded-[11px] border border-border bg-surface px-4.5 py-8 text-center text-sm text-muted">
            No responses yet.
          </div>
        )}
        {page.responses.map((r) => {
          const expanded = expandedId === r.id;
          return (
            <div key={r.id} className="rounded-lg border border-border-strong bg-background">
              <button
                onClick={() => setExpandedId(expanded ? null : r.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="text-[14px] font-medium">{r.respondent}</span>
                <span className="font-mono text-[10.5px] text-faint">{formatDateTime(r.submitted_at)}</span>
              </button>
              {expanded && (
                <div className="flex flex-col gap-3 border-t border-border-strong px-4 py-3.5">
                  {fields.map((f) => (
                    <div key={f.id}>
                      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{f.prompt}</div>
                      <div className="mt-1 text-[13.5px]">
                        {formatAnswer(fieldById.get(f.id), r.answers.find((a) => a.field_id === f.id))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
