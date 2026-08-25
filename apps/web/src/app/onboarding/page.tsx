"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { profileApi, type ExperienceLevel } from "@/lib/api";
import { experienceLevels, goalOptions, interestOptions, mutCourses, yearsOfStudy } from "@/lib/data";
import { useMe } from "@/lib/useMe";

const STEPS = ["Identity", "Interests", "Experience", "Goals", "Profile"];

type FormState = {
  firstName: string;
  lastName: string;
  preferredName: string;
  registrationNumber: string;
  course: string;
  yearOfStudy: number | null;
  interests: string[];
  experienceLevel: ExperienceLevel | null;
  goals: string[];
  bio: string;
  github: string;
  linkedin: string;
};

const initialForm: FormState = {
  firstName: "",
  lastName: "",
  preferredName: "",
  registrationNumber: "",
  course: "",
  yearOfStudy: null,
  interests: [],
  experienceLevel: null,
  goals: [],
  bio: "",
  github: "",
  linkedin: "",
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function OnboardingPage() {
  const router = useRouter();
  const { me, loading: authLoading } = useMe();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !me) router.push("/sign-in");
  }, [authLoading, me, router]);

  if (authLoading || !me) return null;

  const step1Valid = form.firstName.trim() && form.lastName.trim() && form.preferredName.trim();
  const isLastStep = step === STEPS.length;

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      await profileApi.update({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        display_name: form.preferredName.trim(),
        registration_number: form.registrationNumber.trim() || null,
        course: form.course.trim() || null,
        year_of_study: form.yearOfStudy,
        interests: form.interests,
        experience_level: form.experienceLevel,
        goals: form.goals,
        bio: form.bio.trim() || null,
        github_url: form.github.trim() || null,
        linkedin_url: form.linkedin.trim() || null,
      });
      router.push("/welcome");
    } catch {
      setError("Couldn't save your profile — try again.");
      setSubmitting(false);
    }
  }

  function next() {
    if (isLastStep) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-64px)] flex-col">
      <div className="flex overflow-x-auto border-b border-[#161c1e]">
        {STEPS.map((name, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div
              key={name}
              className="min-w-27.5 flex-1 border-r border-[#161c1e] px-4.5 py-4"
              style={{ background: active ? "#0e1314" : "transparent" }}
            >
              <div className={`font-mono text-[10px] tracking-[0.14em] ${active || done ? "text-accent" : "text-faint"}`}>
                {String(n).padStart(2, "0")}
              </div>
              <div
                className={`mt-1.5 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.1em] ${
                  active ? "text-foreground" : "text-faint"
                }`}
              >
                {name}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 sm:py-14">
        <div className="w-full max-w-140">
          {step === 1 && (
            <div className="animate-[rise_0.4s_ease_both]">
              <h1 className="m-0 text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.035em]">What&apos;s your name?</h1>
              <p className="mt-3 mb-8 text-[15.5px] text-[#9aa6a0]">This is how the community will know you.</p>

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

              <div className="mt-5">
                <Field label="what should people call you?">
                  <input
                    value={form.preferredName}
                    onChange={(e) => setForm({ ...form, preferredName: e.target.value })}
                    className="input max-w-65"
                  />
                </Field>
              </div>

              <div className="my-7 h-px bg-[#161c1e]" />

              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">your studies</div>
              <p className="mt-2.5 mb-5.5 text-[14.5px] leading-[1.55] text-muted">
                Only your course and year are ever shown publicly. Your registration number is visible to club admins
                only — we use it to confirm you&apos;re a MUT student.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <Field label="registration number">
                  <input
                    value={form.registrationNumber}
                    onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                    placeholder="SC201/3213/2017"
                    className="input font-mono text-sm tracking-wide"
                  />
                  <div className="mt-2 font-mono text-[10px] text-faint">admins only · never public</div>
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
                            on ? "border-accent-dim bg-accent/10 text-accent" : "border-border-strong text-muted"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>

              <div className="mt-5">
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
                  <div className="mt-2 font-mono text-[10px] text-faint">start typing — MUT courses autocomplete</div>
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-[rise_0.4s_ease_both]">
              <h1 className="m-0 text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.035em]">
                What are you into?
              </h1>
              <p className="mt-3 mb-7.5 text-[15.5px] text-[#9aa6a0]">
                Select everything that interests you. We use this to suggest projects.
              </p>
              <div className="flex flex-wrap gap-2.5">
                {interestOptions.map((label) => {
                  const on = form.interests.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setForm({ ...form, interests: toggle(form.interests, label) })}
                      className={`rounded-full border px-4 py-2.5 text-[14.5px] font-medium transition-transform ${
                        on ? "scale-105 border-accent-dim bg-accent/10 text-accent" : "border-border-strong text-muted"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5.5 font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                {form.interests.length} selected
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-[rise_0.4s_ease_both]">
              <h1 className="m-0 text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.035em]">
                Where are you right now?
              </h1>
              <p className="mt-3 mb-7.5 text-[15.5px] text-[#9aa6a0]">No wrong answer — this isn&apos;t an exam.</p>
              <div className="flex flex-col gap-2.5">
                {experienceLevels.map((lvl) => {
                  const on = form.experienceLevel === lvl.value;
                  return (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setForm({ ...form, experienceLevel: lvl.value })}
                      className={`flex items-center gap-3.5 rounded-[10px] border px-4.5 py-4 text-left text-base ${
                        on ? "border-accent-dim bg-accent/5" : "border-border-strong"
                      }`}
                    >
                      <span
                        className={`grid h-4 w-4 flex-none place-items-center rounded-full border-[1.5px] ${
                          on ? "border-accent" : "border-border-strong"
                        }`}
                      >
                        {on && <span className="h-2 w-2 rounded-full bg-accent" />}
                      </span>
                      <span className="flex-1">{lvl.label}</span>
                      <span className="font-mono text-[10.5px] text-[#5d6a64]">{lvl.tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-[rise_0.4s_ease_both]">
              <h1 className="m-0 text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.035em]">
                What do you want to do here?
              </h1>
              <p className="mt-3 mb-7.5 text-[15.5px] text-[#9aa6a0]">Pick as many as apply.</p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {goalOptions.map((label) => {
                  const on = form.goals.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setForm({ ...form, goals: toggle(form.goals, label) })}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3.5 text-left text-[15.5px] ${
                        on ? "border-accent-dim bg-accent/5" : "border-border-strong"
                      }`}
                    >
                      <span className={`font-mono text-xs ${on ? "text-accent" : "text-faint"}`}>{on ? "✓" : "○"}</span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-[rise_0.4s_ease_both]">
              <h1 className="m-0 text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.035em]">Build your profile</h1>
              <p className="mt-3 mb-6 text-[15.5px] text-[#9aa6a0]">All optional — you can finish this later.</p>

              <div className="mb-6 flex items-center gap-4.5">
                <div className="grid h-18 w-18 flex-none place-items-center rounded-full border border-dashed border-[#2f3a36] font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#5d6a64]">
                  photo
                </div>
                <button type="button" className="rounded-lg border border-border-strong px-4.5 py-2.5 text-sm">
                  Upload
                </button>
              </div>

              <Field label="bio">
                <textarea
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Tell the community about yourself..."
                  className="input resize-y"
                />
              </Field>

              <div className="mt-4.5 grid grid-cols-2 gap-4">
                <Field label="github">
                  <input
                    value={form.github}
                    onChange={(e) => setForm({ ...form, github: e.target.value })}
                    placeholder="github.com/..."
                    className="input font-mono text-[13.5px]"
                  />
                </Field>
                <Field label="linkedin">
                  <input
                    value={form.linkedin}
                    onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                    placeholder="linkedin.com/in/..."
                    className="input font-mono text-[13.5px]"
                  />
                </Field>
              </div>
            </div>
          )}

          {error && <p className="mt-5 text-sm text-danger">{error}</p>}

          <div className="mt-9 flex items-center gap-3.5">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg border border-border-strong px-5 py-3 text-[14.5px] text-muted"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              disabled={(step === 1 && !step1Valid) || submitting}
              className="rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#04140b] hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Saving…" : isLastStep ? "Finish" : "Continue"}
            </button>
            {step > 1 && (
              <span onClick={next} className="ml-auto cursor-pointer font-mono text-[11px] text-muted">
                skip
              </span>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          background: #0d1112;
          border: 1px solid #232b2d;
          border-radius: 8px;
          padding: 12px 14px;
          color: #e8eeea;
          font-size: 15px;
          outline: none;
        }
        :global(.input:focus) {
          border-color: #3dfa8a;
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{label}</label>
      {children}
    </div>
  );
}
