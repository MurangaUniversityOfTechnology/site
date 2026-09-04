"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, formApi, type AnswerValue, type FormPublic } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { signInHref } from "@/lib/nextParam";

export function FillFormClient({ slug }: { slug: string }) {
  const router = useRouter();
  const { me, loading } = useMe();
  const [form, setForm] = useState<FormPublic | null | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    formApi
      .get(slug)
      .then((result) => {
        if (active) setForm(result);
      })
      .catch(() => {
        if (active) setForm(null);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!loading && form?.require_login && !me) router.push(signInHref(`/forms/${slug}`));
  }, [loading, me, form, router, slug]);

  function setAnswer(fieldId: string, value: AnswerValue) {
    setAnswers((a) => ({ ...a, [fieldId]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    for (const field of form.fields) {
      const value = answers[field.id];
      const empty = value === undefined || value === "" || value === null || (Array.isArray(value) && value.length === 0);
      if (field.required && empty) {
        setError(`"${field.prompt}" is required.`);
        return;
      }
    }
    setError(null);
    setBusy(true);
    try {
      await formApi.submit(
        form.slug,
        form.fields.map((f) => ({ field_id: f.id, value: answers[f.id] ?? null }))
      );
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your response.");
    } finally {
      setBusy(false);
    }
  }

  if (form === undefined || (form?.require_login && loading)) return null;

  if (!form) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
        <h1 className="text-2xl tracking-[-0.02em]">Form not found</h1>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">thank you</div>
          <h1 className="mt-3.5 text-2xl tracking-[-0.02em]">Your response was recorded.</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-140 px-5 py-14 sm:px-8">
      <h1 className="text-[clamp(28px,5vw,44px)] leading-[1.05] tracking-[-0.03em]">{form.title}</h1>
      {form.description && <p className="mt-4 text-[15.5px] leading-[1.6] text-muted">{form.description}</p>}

      {form.closed ? (
        <div className="mt-7 rounded-xl border border-border bg-surface p-6 text-center text-[14.5px] text-muted">
          This form is no longer accepting responses.
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 flex flex-col gap-6">
          {form.fields.map((field) => (
            <FieldInput key={field.id} field={field} value={answers[field.id]} onChange={(v) => setAnswer(field.id, v)} />
          ))}

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-fit rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit"}
          </button>
        </form>
      )}
    </main>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormPublic["fields"][number];
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const inputClass = "w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent";

  return (
    <label className="block">
      <div className="text-[14.5px] font-medium">
        {field.prompt}
        {field.required && <span className="ml-1 text-danger">*</span>}
      </div>
      {field.help_text && <div className="mt-1 text-[12.5px] text-faint">{field.help_text}</div>}

      <div className="mt-2.5">
        {field.type === "short_text" && (
          <input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />
        )}
        {field.type === "long_text" && (
          <textarea rows={4} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />
        )}
        {field.type === "email" && (
          <input type="email" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />
        )}
        {field.type === "number" && (
          <input type="number" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />
        )}
        {field.type === "date" && (
          <input type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />
        )}
        {field.type === "yes_no" && (
          <div className="flex gap-2">
            {[
              { label: "Yes", v: true },
              { label: "No", v: false },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => onChange(opt.v)}
                className={`rounded-lg border px-4 py-2 text-[13.5px] ${
                  value === opt.v ? "border-accent-dim bg-accent/10 text-navy" : "border-border-strong text-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {field.type === "rating" && (
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`h-10 w-10 rounded-lg border font-mono text-[13px] ${
                  value === n ? "border-accent-dim bg-accent/10 text-navy" : "border-border-strong text-muted"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}
        {field.type === "dropdown" && (
          <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value ? [e.target.value] : [])} className={inputClass}>
            <option value="">Select…</option>
            {field.choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.text}
              </option>
            ))}
          </select>
        )}
        {field.type === "single_choice" && (
          <div className="flex flex-col gap-2">
            {field.choices.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5 text-[13.5px]">
                <input
                  type="radio"
                  name={field.id}
                  checked={Array.isArray(value) && value.includes(c.id)}
                  onChange={() => onChange([c.id])}
                  className="accent-accent"
                />
                {c.text}
              </label>
            ))}
          </div>
        )}
        {field.type === "multi_choice" && (
          <div className="flex flex-col gap-2">
            {field.choices.map((c) => {
              const selected = Array.isArray(value) && value.includes(c.id);
              return (
                <label key={c.id} className="flex items-center gap-2.5 text-[13.5px]">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => {
                      const current = Array.isArray(value) ? value : [];
                      onChange(selected ? current.filter((v) => v !== c.id) : [...current, c.id]);
                    }}
                    className="accent-accent"
                  />
                  {c.text}
                </label>
              );
            })}
          </div>
        )}
      </div>
    </label>
  );
}
