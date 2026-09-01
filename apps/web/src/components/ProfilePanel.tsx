"use client";

import { useEffect, useState } from "react";
import { ApiError, profileApi, type ExperienceLevel, type ProfileVisibility } from "@/lib/api";
import { experienceLevels, goalOptions, interestOptions, mutCourses, yearsOfStudy } from "@/lib/data";

type FormState = {
  firstName: string;
  lastName: string;
  preferredName: string;
  registrationNumber: string;
  phone: string;
  course: string;
  yearOfStudy: number | null;
  interests: string[];
  experienceLevel: ExperienceLevel | null;
  goals: string[];
  bio: string;
  github: string;
  linkedin: string;
  visibility: ProfileVisibility;
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function ProfilePanel() {
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    profileApi.me().then((p) => {
      if (!active) return;
      setForm({
        firstName: p.first_name ?? "",
        lastName: p.last_name ?? "",
        preferredName: p.display_name ?? "",
        registrationNumber: p.registration_number ?? "",
        phone: p.phone ?? "",
        course: p.course ?? "",
        yearOfStudy: p.year_of_study,
        interests: p.interests,
        experienceLevel: p.experience_level,
        goals: p.goals,
        bio: p.bio ?? "",
        github: p.github_url ?? "",
        linkedin: p.linkedin_url ?? "",
        visibility: p.visibility,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  if (!form) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setSuccess(false);
    setBusy(true);
    try {
      await profileApi.update({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        display_name: form.preferredName.trim(),
        registration_number: form.registrationNumber.trim() || null,
        phone: form.phone.trim() || null,
        course: form.course.trim() || null,
        year_of_study: form.yearOfStudy,
        interests: form.interests,
        experience_level: form.experienceLevel,
        goals: form.goals,
        bio: form.bio.trim() || null,
        github_url: form.github.trim() || null,
        linkedin_url: form.linkedin.trim() || null,
        visibility: form.visibility,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your profile.");
    } finally {
      setBusy(false);
    }
  }

  const visibilityOptions: { value: ProfileVisibility; label: string }[] = [
    { value: "public", label: "Public" },
    { value: "members", label: "Club members" },
    { value: "private", label: "Private" },
  ];

  return (
    <div className="mt-8 max-w-140 rounded-xl border border-border bg-surface p-6">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">profile</div>
      <p className="mt-2.5 text-[14px] leading-[1.55] text-muted">
        This is how the community sees you — update it any time.
      </p>

      <form onSubmit={submit} className="mt-5.5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="first name">
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="last name">
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="input"
            />
          </Field>
        </div>

        <Field label="what should people call you?">
          <input
            value={form.preferredName}
            onChange={(e) => setForm({ ...form, preferredName: e.target.value })}
            className="input max-w-65"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="registration number (admins only)">
            <input
              value={form.registrationNumber}
              onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
              placeholder="SC201/3213/2017"
              className="input font-mono text-sm tracking-wide"
            />
          </Field>
          <Field label="year of study">
            <div className="flex flex-wrap gap-1.5">
              {yearsOfStudy.map((label, i) => {
                const on = form.yearOfStudy === i + 1;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setForm({ ...form, yearOfStudy: i + 1 })}
                    className={`w-13 rounded-lg border py-2.5 font-mono text-[13px] ${
                      on ? "border-accent-dim bg-accent/10 text-navy" : "border-border-strong text-muted"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <Field label="course">
          <input
            value={form.course}
            onChange={(e) => setForm({ ...form, course: e.target.value })}
            list="mut-courses"
            className="input"
          />
          <datalist id="mut-courses">
            {mutCourses.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field label="phone number (admins only)">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="0712 345 678"
            className="input max-w-65 font-mono text-sm tracking-wide"
          />
        </Field>

        <Field label="interests">
          <div className="flex flex-wrap gap-2">
            {interestOptions.map((label) => {
              const on = form.interests.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setForm({ ...form, interests: toggle(form.interests, label) })}
                  className={`rounded-full border px-3.5 py-2 text-[13.5px] ${
                    on ? "border-accent-dim bg-accent/10 text-navy" : "border-border-strong text-muted"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="experience">
          <div className="flex flex-col gap-2">
            {experienceLevels.map((lvl) => {
              const on = form.experienceLevel === lvl.value;
              return (
                <button
                  key={lvl.value}
                  type="button"
                  onClick={() => setForm({ ...form, experienceLevel: lvl.value })}
                  className={`rounded-lg border px-3.5 py-2.5 text-left text-[14px] ${
                    on ? "border-accent-dim bg-accent/5 text-navy" : "border-border-strong text-muted"
                  }`}
                >
                  {lvl.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="goals">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {goalOptions.map((label) => {
              const on = form.goals.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setForm({ ...form, goals: toggle(form.goals, label) })}
                  className={`rounded-lg border px-3.5 py-2.5 text-left text-[13.5px] ${
                    on ? "border-accent-dim bg-accent/5 text-navy" : "border-border-strong text-muted"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="bio">
          <textarea
            rows={3}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="input resize-y"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="github">
            <input
              value={form.github}
              onChange={(e) => setForm({ ...form, github: e.target.value })}
              placeholder="github.com/..."
              className="input font-mono text-[13px]"
            />
          </Field>
          <Field label="linkedin">
            <input
              value={form.linkedin}
              onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
              placeholder="linkedin.com/in/..."
              className="input font-mono text-[13px]"
            />
          </Field>
        </div>

        <Field label="profile visibility">
          <div className="flex flex-col gap-2">
            {visibilityOptions.map((opt) => {
              const on = form.visibility === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, visibility: opt.value })}
                  className={`rounded-lg border px-3.5 py-2.5 text-left text-[14px] ${
                    on ? "border-accent-dim bg-accent/5 text-navy" : "border-border-strong text-muted"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}
        {success && <p className="text-sm text-navy">Profile updated ✓</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 w-fit rounded-lg bg-accent px-6 py-3 text-[14.5px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          background: #ffffff;
          border: 1px solid #c9bd9e;
          border-radius: 8px;
          padding: 10px 12px;
          color: #1a1a1a;
          font-size: 14.5px;
          outline: none;
        }
        :global(.input:focus) {
          border-color: #c9a84c;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{label}</div>
      {children}
    </label>
  );
}
