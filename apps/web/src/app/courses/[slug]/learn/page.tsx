"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMe } from "@/lib/useMe";
import { ApiError, courseApi, type CourseDetail, type ModulePublic } from "@/lib/api";

export default function LearnPage() {
  const { slug } = useParams<{ slug: string }>();
  const { me, loading: meLoading } = useMe();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [modules, setModules] = useState<ModulePublic[] | null>(null);
  const [finalExamLocked, setFinalExamLocked] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (meLoading || !me) return;
    let active = true;
    courseApi.get(slug).then((result) => {
      if (active) setCourse(result);
    });
    courseApi
      .modules(slug)
      .then((result) => {
        if (!active) return;
        setModules(result);
      })
      .catch((err) => {
        if (active && err instanceof ApiError && err.status === 403) setDenied(true);
      });
    courseApi
      .finalExamIntro(slug)
      .then(() => {
        if (active) setFinalExamLocked(false);
      })
      .catch(() => {
        // 403 (module quizzes not all passed yet) or 404 (no final exam) — stays locked either way
      });
    return () => {
      active = false;
    };
  }, [slug, me, meLoading]);

  if (meLoading) return null;

  if (!me) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em]">Sign in to continue this course</h1>
          <Link href="/sign-in" className="mt-3 inline-block text-navy hover:underline">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (denied) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em]">You don&apos;t have access to this course</h1>
          <p className="mt-2 text-sm text-muted">Enroll first, or check that your membership is still active.</p>
          <Link href={`/courses/${slug}`} className="mt-3 inline-block text-navy hover:underline">
            Back to course
          </Link>
        </div>
      </main>
    );
  }

  if (!course || !modules) return null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-10">
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface px-6 py-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(255,184,97,.08),transparent_66%)]" />
        <Link href={`/courses/${slug}`} className="relative font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-foreground">
          ← {course.title}
        </Link>
        <h1 className="relative mt-3 text-[clamp(24px,4vw,36px)] tracking-[-0.03em]">Learn</h1>
      </div>

      <div className="mt-6 flex flex-col gap-px overflow-hidden rounded-[10px] border border-border bg-border">
        {modules.map((m, i) => (
          <div key={m.id} className="flex flex-col gap-3 bg-surface px-5 py-4.5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[13px] text-faint">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex-1">
                <div className="text-[15px] font-medium">
                  {m.locked && "🔒 "}
                  {m.title}
                </div>
                {m.summary && <div className="mt-0.5 text-[13px] text-muted">{m.summary}</div>}
              </div>
              {m.quiz_passed && <span className="font-mono text-[11px] font-semibold text-navy">passed ✓</span>}
            </div>

            {!m.locked && (
              <div className="ml-7 flex flex-col gap-1.5">
                {m.lessons.map((l) => (
                  <Link
                    key={l.id}
                    href={`/courses/${slug}/learn/lessons/${l.id}`}
                    className="flex items-center gap-2 text-[13.5px] text-muted hover:text-foreground"
                  >
                    <span>{l.completed ? "✓" : "·"}</span>
                    {l.title}
                  </Link>
                ))}
                <Link
                  href={`/courses/${slug}/learn/modules/${m.id}/quiz`}
                  className="mt-1.5 w-fit rounded-md border border-border-strong px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted hover:border-accent-dim hover:text-navy"
                >
                  {m.quiz_passed ? "retake quiz" : "take quiz"}
                </Link>
              </div>
            )}
          </div>
        ))}

        <div className="flex items-center gap-3 bg-surface px-5 py-4.5">
          <span className="font-mono text-[13px] text-faint">{String(modules.length + 1).padStart(2, "0")}</span>
          <div className="flex-1">
            <div className="text-[15px] font-medium">{finalExamLocked && "🔒 "}Final exam</div>
          </div>
          {!finalExamLocked && (
            <Link
              href={`/courses/${slug}/learn/final-exam`}
              className="rounded-md border border-border-strong px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted hover:border-accent-dim hover:text-navy"
            >
              start
            </Link>
          )}
        </div>
      </div>

      <Link
        href={`/courses/${slug}/certificate`}
        className="mt-6 inline-block font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-foreground"
      >
        view certificate →
      </Link>
    </main>
  );
}
