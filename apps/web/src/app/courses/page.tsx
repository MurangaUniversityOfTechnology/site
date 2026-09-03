"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { courseApi, type Arm, type CourseSummary } from "@/lib/api";

export default function CoursesPage() {
  const [arms, setArms] = useState<Arm[] | null>(null);
  const [selectedArm, setSelectedArm] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);

  useEffect(() => {
    let active = true;
    courseApi.arms().then((result) => {
      if (active) setArms(result);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    courseApi.list(selectedArm ?? undefined).then((result) => {
      if (active) setCourses(result);
    });
    return () => {
      active = false;
    };
  }, [selectedArm]);

  return (
    <main className="px-5 py-12 sm:px-10 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">learn by building</div>
      <h1 className="mt-3.5 text-[clamp(30px,5vw,54px)] leading-none tracking-[-0.04em]">COURSES</h1>
      <p className="mt-3.5 max-w-140 text-[15.5px] text-muted">
        Free for active members. Short lessons, a quiz to unlock each next module, a real project to build, and an
        elaborate final exam to prove it stuck.
      </p>

      {arms && arms.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedArm(null)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] ${
              selectedArm === null ? "border-accent-dim bg-accent/[0.08] text-navy" : "border-border-strong text-muted"
            }`}
          >
            All
          </button>
          {arms.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedArm(a.slug)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] ${
                selectedArm === a.slug ? "border-accent-dim bg-accent/[0.08] text-navy" : "border-border-strong text-muted"
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {courses?.length === 0 && (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
            {selectedArm ? "nothing here yet" : "coming soon"}
          </div>
          <p className="mt-3 text-[15.5px] text-muted">
            {selectedArm ? "No courses in this arm yet — check back soon." : "No courses published yet — check back soon."}
          </p>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses?.map((c) => (
          <Link
            key={c.slug}
            href={`/courses/${c.slug}`}
            className="flex flex-col rounded-xl border border-border bg-surface p-5 hover:border-accent-dim"
          >
            {c.cover_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.cover_image_url} alt="" className="mb-4 h-32 w-full rounded-lg object-cover" />
            )}
            <div className="text-lg font-semibold leading-[1.3] tracking-[-0.01em]">{c.title}</div>
            <p className="mt-2 flex-1 text-[13.5px] leading-[1.55] text-muted">{c.short_description}</p>
            {c.arms.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.arms.map((a) => (
                  <span
                    key={a.id}
                    className="rounded border border-border-strong px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-faint"
                  >
                    {a.name}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between">
              <span className="font-mono text-[10.5px] text-faint">
                {c.module_count} module{c.module_count === 1 ? "" : "s"}
              </span>
              <span className="rounded border border-border-strong px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                {c.price_kes === 0 ? "free" : `KSh ${c.price_kes} · free for members`}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
