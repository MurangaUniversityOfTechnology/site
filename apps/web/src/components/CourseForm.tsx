"use client";

import { useState } from "react";
import { CourseBadge } from "@/components/CourseBadge";
import { DIFFICULTY_LABELS } from "@/components/DifficultyLevel";
import { ApiError, adminApi, type CourseWritePayload } from "@/lib/api";

export type CourseFormValues = {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  coverImageUrl: string;
  priceKes: string;
  difficulty: number;
};

export const emptyCourseForm: CourseFormValues = {
  slug: "",
  title: "",
  shortDescription: "",
  description: "",
  coverImageUrl: "",
  priceKes: "0",
  difficulty: 1,
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
    difficulty: v.difficulty,
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function setTitle(title: string) {
    onChange({ ...values, title, slug: slugTouched ? values.slug : slugify(title) });
  }

  async function uploadCoverImage(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const { url } = await adminApi.uploadFile(file);
      onChange({ ...values, coverImageUrl: url });
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Couldn't upload image.");
    } finally {
      setUploading(false);
    }
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
      <Field label="Cover image (optional)">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <input
              value={values.coverImageUrl}
              onChange={(e) => onChange({ ...values, coverImageUrl: e.target.value })}
              placeholder="https://… (paste a URL, or upload one below)"
              className="flex-1 rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
            {values.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={values.coverImageUrl} alt="" className="h-10 w-16 rounded object-cover" />
            )}
          </div>
          <label className="w-fit cursor-pointer rounded-md border border-border-strong px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted hover:border-accent-dim">
            {uploading ? "Uploading…" : "Upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) uploadCoverImage(file);
              }}
              className="hidden"
            />
          </label>
          {uploadError && <p className="text-sm text-danger">{uploadError}</p>}
        </div>
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
      <Field label="Difficulty — sets the shape and finish of the completion badge students earn">
        <div className="flex flex-wrap items-center gap-4.5">
          <div className="flex gap-1.5">
            {([1, 2, 3, 4, 5] as const).map((level) => {
              const on = values.difficulty === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => onChange({ ...values, difficulty: level })}
                  className={`flex w-19 flex-col items-center gap-1 rounded-lg border py-2.5 ${
                    on ? "border-accent-dim bg-accent/10" : "border-border-strong"
                  }`}
                >
                  <span className={`font-mono text-[13px] ${on ? "text-navy" : "text-muted"}`}>{level}</span>
                  <span className={`text-[9.5px] leading-tight ${on ? "text-navy" : "text-faint"}`}>
                    {DIFFICULTY_LABELS[level]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border border-border-strong bg-background px-3.5 py-2">
            <CourseBadge slug={values.slug || "preview"} title={values.title || "New Course"} difficulty={values.difficulty} size="md" />
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
              badge
              <br />
              preview
            </span>
          </div>
        </div>
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
