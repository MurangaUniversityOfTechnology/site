"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMe } from "@/lib/useMe";
import { courseApi, type CourseDetail, type CourseProgress } from "@/lib/api";

export default function CertificatePage() {
  const { slug } = useParams<{ slug: string }>();
  const { me } = useMe();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    courseApi.get(slug).then((result) => {
      if (active) setCourse(result);
    });
    courseApi
      .progress(slug)
      .then((result) => {
        if (active) setProgress(result);
      })
      .catch(() => {
        if (active) setProgress(null);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  if (progress === undefined || !course) return null;

  if (!progress || !progress.completed_at) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em]">Not completed yet</h1>
          <p className="mt-2 text-sm text-muted">Finish every module and pass the final exam to earn your certificate.</p>
          <Link href={`/courses/${slug}/learn`} className="mt-3 inline-block text-navy hover:underline">
            Continue course
          </Link>
        </div>
      </main>
    );
  }

  const completedDate = new Date(progress.completed_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-10 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/courses/${slug}/learn`} className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-foreground">
          ← back to course
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-md border border-border-strong px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted hover:border-accent-dim hover:text-navy"
        >
          print / save
        </button>
      </div>

      <div className="mt-6 rounded-2xl border-4 border-navy bg-surface px-10 py-14 text-center print:mt-0 print:border-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent-dim">MUT Tech Community</div>
        <div className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Certificate of Completion</div>
        <div className="mt-6 text-[15px] text-muted">This certifies that</div>
        <div className="mt-2 text-[clamp(24px,4vw,36px)] tracking-[-0.02em] text-navy">{me?.email ?? "A learner"}</div>
        <div className="mt-4 text-[15px] text-muted">has successfully completed</div>
        <div className="mt-2 text-[clamp(20px,3vw,28px)] font-medium tracking-[-0.02em]">{course.title}</div>
        <div className="mt-6 font-mono text-[12px] text-faint">{completedDate}</div>
      </div>
    </main>
  );
}
