"use client";

import { useState } from "react";
import { type FormWritePayload } from "@/lib/api";

export type FormSettingsValues = {
  slug: string;
  title: string;
  description: string;
  requireLogin: boolean;
  closesAt: string; // <input type="datetime-local"> value, or "" for no deadline
};

export const emptyFormSettings: FormSettingsValues = {
  slug: "",
  title: "",
  description: "",
  requireLogin: true,
  closesAt: "",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function valuesToPayload(v: FormSettingsValues): FormWritePayload {
  return {
    slug: v.slug.trim(),
    title: v.title.trim(),
    description: v.description.trim(),
    require_login: v.requireLogin,
    closes_at: v.closesAt ? new Date(v.closesAt).toISOString() : null,
  };
}

export function FormSettingsFields({
  values,
  onChange,
  slugEditable,
}: {
  values: FormSettingsValues;
  onChange: (v: FormSettingsValues) => void;
  slugEditable: boolean;
}) {
  const [slugTouched, setSlugTouched] = useState(slugEditable === false);

  function setTitle(title: string) {
    onChange({ ...values, title, slug: slugTouched ? values.slug : slugify(title) });
  }

  return (
    <div className="flex flex-col gap-4.5">
      <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
        <Field label="Title">
          <input
            required
            value={values.title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Slug (used in the URL)">
          <input
            required
            value={values.slug}
            disabled={!slugEditable}
            onChange={(e) => {
              setSlugTouched(true);
              onChange({ ...values, slug: slugify(e.target.value) });
            }}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent disabled:opacity-60"
          />
        </Field>
      </div>
      <Field label="Description (shown above the questions)">
        <textarea
          value={values.description}
          onChange={(e) => onChange({ ...values, description: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
      </Field>
      <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
        <Field label="Closes (optional)">
          <input
            type="datetime-local"
            value={values.closesAt}
            onChange={(e) => onChange({ ...values, closesAt: e.target.value })}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Access">
          <label className="flex h-10.5 items-center gap-2 text-[13.5px] text-muted">
            <input
              type="checkbox"
              checked={values.requireLogin}
              onChange={(e) => onChange({ ...values, requireLogin: e.target.checked })}
              className="accent-accent"
            />
            Require sign-in to respond
          </label>
        </Field>
      </div>
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
