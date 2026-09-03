"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CourseBadge } from "@/components/CourseBadge";
import { CourseEnrollPanel } from "@/components/CourseEnrollPanel";
import { courseApi, type CourseDetail } from "@/lib/api";

export default function CourseDetailPage() {
  const params = useParams<{ slug: string }>();
  const [course, setCourse] = useState<CourseDetail | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    courseApi
      .get(params.slug)
      .then((result) => {
        if (active) setCourse(result);
      })
      .catch(() => {
        if (active) setCourse(null);
      });
    return () => {
      active = false;
    };
  }, [params.slug]);

  if (course === undefined) return null;

  if (!course) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em]">Course not found</h1>
          <Link href="/courses" className="mt-3 inline-block text-navy hover:underline">
            Back to courses
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="relative overflow-hidden bg-[repeating-linear-gradient(115deg,rgba(26,39,68,.028)_0_2px,transparent_2px_12px)] px-5 py-14 sm:px-10 sm:py-20">
        <div className="pointer-events-none absolute -right-24 -top-36 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(255,184,97,.08),transparent_66%)]" />
        <Link href="/courses" className="relative font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-foreground">
          ← courses
        </Link>
        {course.arms.length > 0 && (
          <div className="relative mt-4 flex flex-wrap gap-1.5">
            {course.arms.map((a) => (
              <span
                key={a.id}
                className="rounded border border-accent-dim px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-navy"
              >
                {a.name}
              </span>
            ))}
          </div>
        )}
        <h1 className="relative mt-5.5 text-[clamp(36px,7vw,84px)] uppercase leading-[0.95] tracking-[-0.045em]">
          {course.title}
        </h1>
        <p className="relative mt-5 max-w-[560px] text-[17px] leading-[1.55] text-[#7a7060]">{course.description}</p>

        <div className="relative mt-9 flex max-w-[420px] flex-wrap gap-px overflow-hidden rounded-[10px] border border-border bg-border">
          <div className="min-w-32 flex-1 bg-surface px-5.5 py-4">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">modules</div>
            <div className="mt-1.5 text-[17px] font-semibold">{course.module_count}</div>
          </div>
          <div className="min-w-32 flex-1 bg-surface px-5.5 py-4">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">price</div>
            <div className="mt-1.5 text-[17px] font-semibold">
              {course.price_kes === 0 ? "Free" : `KSh ${course.price_kes}`}
            </div>
          </div>
        </div>

        {course.price_kes > 0 && (
          <p className="relative mt-3 font-mono text-[11px] text-faint">Free for active club members.</p>
        )}

        <div className="relative mt-7 flex flex-wrap items-center gap-3">
          <CourseEnrollPanel slug={course.slug} priceKes={course.price_kes} />
          {course.enrolled && (
            <Link
              href={`/courses/${course.slug}/learn`}
              className="rounded-lg border border-accent-dim px-6.5 py-3.5 text-[15px] font-semibold text-navy hover:bg-accent/10"
            >
              {course.completed ? "Review course" : "Continue learning"}
            </Link>
          )}
        </div>

        {course.completed && (
          <div className="relative mt-6 flex items-center gap-3.5 rounded-lg border border-accent-dim bg-accent/[0.05] px-4.5 py-3.5">
            <CourseBadge slug={course.slug} title={course.title} />
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-navy">badge earned</div>
              <div className="text-[13.5px] text-muted">You completed this course.</div>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-12 sm:px-10">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">what you&apos;ll cover</div>
        <div className="mt-5 flex flex-col gap-px overflow-hidden rounded-[10px] border border-border bg-border">
          {course.modules.map((m, i) => (
            <div key={m.id} className="flex items-center gap-4 bg-surface px-5 py-4">
              <span className="font-mono text-[13px] text-faint">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex-1">
                <div className="text-[15px] font-medium">{m.title}</div>
                {m.summary && <div className="mt-1 text-[13px] text-muted">{m.summary}</div>}
              </div>
              <span className="font-mono text-[10.5px] text-faint">
                {m.lesson_count} lesson{m.lesson_count === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
