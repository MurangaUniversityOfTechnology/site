"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormFieldBuilder } from "@/components/FormFieldBuilder";
import { FormSettingsFields, type FormSettingsValues, valuesToPayload } from "@/components/FormSettingsFields";
import { ApiError, adminApi, type AdminFormRow } from "@/lib/api";

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<AdminFormRow | null>(null);
  const [values, setValues] = useState<FormSettingsValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  function applyForm(found: AdminFormRow) {
    setForm(found);
    setValues({
      slug: found.slug,
      title: found.title,
      description: found.description,
      requireLogin: found.require_login,
      closesAt: toLocalDatetimeInput(found.closes_at),
    });
  }

  useEffect(() => {
    let active = true;
    adminApi.listForms(false).then((rows) => {
      if (!active) return;
      const found = rows.find((f) => f.slug === slug);
      if (found) applyForm(found);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await adminApi.updateForm(slug, valuesToPayload(values));
      applyForm(updated);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save form.");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishError(null);
    try {
      applyForm(await adminApi.publishForm(slug));
    } catch (err) {
      setPublishError(err instanceof ApiError ? err.message : "Couldn't publish form.");
    }
  }

  async function unpublish() {
    setPublishError(null);
    try {
      applyForm(await adminApi.unpublishForm(slug));
    } catch (err) {
      setPublishError(err instanceof ApiError ? err.message : "Couldn't unpublish form.");
    }
  }

  if (!form || !values) return null;

  return (
    <div className="max-w-3xl">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">forms</div>
      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <h1 className="text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">{form.title}</h1>
        <span
          className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.08em] ${
            form.published_at ? "bg-accent/[0.12] text-navy" : "border border-border-strong text-muted"
          }`}
        >
          {form.published_at ? "published" : "draft"}
        </span>
        {form.published_at && (
          <a
            href={`/forms/${form.slug}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10.5px] text-faint hover:text-foreground"
          >
            /forms/{form.slug} ↗
          </a>
        )}
      </div>

      <div className="mt-6.5 rounded-xl border border-border bg-surface p-6">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">details</div>
        <form onSubmit={saveForm} className="mt-4.5">
          <FormSettingsFields values={values} onChange={setValues} slugEditable={false} />
          {saveError && <p className="mt-4 text-sm text-danger">{saveError}</p>}
          <button
            type="submit"
            disabled={saving}
            className="mt-5 w-fit rounded-lg bg-accent px-6 py-3 text-[14.5px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save details"}
          </button>
        </form>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">fields</div>
          {form.published_at ? (
            <button
              onClick={unpublish}
              className="rounded-md border border-border-strong px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted"
            >
              unpublish
            </button>
          ) : (
            <button
              onClick={publish}
              className="rounded-md bg-accent px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744]"
            >
              publish
            </button>
          )}
        </div>
        {publishError && <p className="mt-3 text-sm text-danger">{publishError}</p>}

        <div className="mt-4.5">
          <FormFieldBuilder formSlug={slug} />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Link
          href={`/admin/forms/${slug}/responses`}
          className="rounded-md border border-border-strong px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted"
        >
          view responses ({form.response_count})
        </Link>
      </div>
    </div>
  );
}
