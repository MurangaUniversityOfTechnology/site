"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMe } from "@/lib/useMe";
import { ApiError, courseApi, type CourseDetail, type CourseProgress, type ModulePublic } from "@/lib/api";
import { signInHref } from "@/lib/nextParam";

function nextStep(
  slug: string,
  modules: ModulePublic[],
  progress: CourseProgress
): { href: string; label: string } {
  const currentModule = modules.find((m) => !m.locked && !m.quiz_passed);
  if (currentModule) {
    const nextLesson = currentModule.lessons.find((l) => !l.completed);
    if (nextLesson) return { href: `/courses/${slug}/learn/lessons/${nextLesson.id}`, label: "Continue lesson" };
    return { href: `/courses/${slug}/learn/modules/${currentModule.id}/quiz`, label: "Take module quiz" };
  }
  if (!progress.final_exam_passed) return { href: `/courses/${slug}/learn/final-exam`, label: "Take final exam" };
  if (progress.capstone_status && progress.capstone_status !== "approved") {
    return { href: `/courses/${slug}/learn/capstone`, label: "Submit capstone project" };
  }
  return { href: `/courses/${slug}`, label: "Back to course" };
}

export default function LearnPage() {
  const { slug } = useParams<{ slug: string }>();
  const { me, loading: meLoading } = useMe();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [modules, setModules] = useState<ModulePublic[] | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
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
        if (active) setModules(result);
      })
      .catch((err) => {
        if (active && err instanceof ApiError && err.status === 403) setDenied(true);
      });
    courseApi
      .progress(slug)
      .then((result) => {
        if (active) setProgress(result);
      })
      .catch(() => {
        // already surfaced via the modules fetch above if this is an access problem
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
          <Link href={signInHref(`/courses/${slug}/learn`)} className="mt-3 inline-block text-navy hover:underline">
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

  if (!course || !modules || !progress) return null;

  const modulesCompleted = modules.filter((m) => m.quiz_passed).length;
  const step = nextStep(slug, modules, progress);
  const isDone = !!progress.completed_at;

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-10">
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface px-6 py-10 text-center">
        <div className="pointer-events-none absolute -right-16 -top-24 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(255,184,97,.08),transparent_66%)]" />
        <div className="relative font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">{course.title}</div>
        <h1 className="relative mt-3 text-[clamp(24px,4vw,36px)] tracking-[-0.03em]">
          {isDone ? "Course complete 🎓" : "Welcome back"}
        </h1>
        <p className="relative mt-3 text-[14.5px] text-muted">
          {modulesCompleted} of {modules.length} modules passed
          {progress.final_exam_passed && " · final exam passed"}
        </p>

        {!isDone && (
          <Link
            href={step.href}
            className="relative mt-7 inline-block rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
          >
            {step.label}
          </Link>
        )}

        <div className="relative mt-6 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint lg:hidden">
          Use the course menu above to jump to any lesson or quiz.
        </div>
      </div>
    </main>
  );
}
