"use client";

import { useState } from "react";
import type { CourseWritePayload } from "@/lib/api";

export type CourseFormValues = {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  coverImageUrl: string;
  priceKes: string;
};

export const emptyCourseForm: CourseFormValues = {
  slug: "",
  title: "",
  shortDescription: "",
  description: "",
  coverImageUrl: "",
  priceKes: "0",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function valuesToPayload(v: CourseFormValues): CourseWritePayload {
  return {
    slug: v.slug.trim(),
    title: v.title.trim(),
    short_description: v.shortDescription.trim(),
    description: v.description.trim(),
    cover_image_url: v.coverImageUrl.trim() || null,
    price_kes: Number(v.priceKes) || 0,
  };
}

export function CourseForm({
  values,
  onChange,
  slugEditable,
}: {
  values: CourseFormValues;
  onChange: (v: CourseFormValues) => void;
  slugEditable: boolean;
}) {
  const [slugTouched, setSlugTouched] = useState(slugEditable === false);

  function setTitle(title: string) {
    onChange({ ...values, title, slug: slugTouched ? values.slug : slugify(title) });
  }

  return (
    <div className="flex flex-col gap-4.5">
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
      <Field label="Short description (shown on the catalog card)">
        <textarea
          required
          value={values.shortDescription}
          onChange={(e) => onChange({ ...values, shortDescription: e.target.value })}
          rows={2}
          className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
      </Field>
      <Field label="Full description (shown on the course page)">
        <textarea
          value={values.description}
          onChange={(e) => onChange({ ...values, description: e.target.value })}
          rows={5}
          className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
      </Field>
      <Field label="Cover image URL (optional)">
        <input
          value={values.coverImageUrl}
          onChange={(e) => onChange({ ...values, coverImageUrl: e.target.value })}
          placeholder="https://…"
          className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
      </Field>
      <Field label="Price, KSh (0 = free for everyone; otherwise free for active members, paid for everyone else)">
        <input
          type="number"
          min={0}
          value={values.priceKes}
          onChange={(e) => onChange({ ...values, priceKes: e.target.value })}
          className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
        />
      </Field>
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
