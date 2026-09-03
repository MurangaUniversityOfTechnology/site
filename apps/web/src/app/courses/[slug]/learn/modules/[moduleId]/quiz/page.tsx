"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { QuizTaker } from "@/components/QuizTaker";
import { ApiError, courseApi, type QuizForAttempt } from "@/lib/api";

export default function ModuleQuizPage() {
  const { slug, moduleId } = useParams<{ slug: string; moduleId: string }>();
  const [quiz, setQuiz] = useState<QuizForAttempt | null | undefined>(undefined);
  const [denied, setDenied] = useState(false);
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    let active = true;
    courseApi
      .moduleQuiz(slug, moduleId)
      .then((result) => {
        if (active) setQuiz(result);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 403) setDenied(true);
        setQuiz(null);
      });
    return () => {
      active = false;
    };
  }, [slug, moduleId]);

  if (quiz === undefined) return null;

  if (!quiz) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em]">{denied ? "This module is locked" : "Quiz not found"}</h1>
          <Link href={`/courses/${slug}/learn`} className="mt-3 inline-block text-navy hover:underline">
            Back to course
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-10">
      <Link href={`/courses/${slug}/learn`} className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-foreground">
        ← back to modules
      </Link>
      <h1 className="mt-4 text-[clamp(24px,3.6vw,36px)] tracking-[-0.03em]">Module quiz</h1>
      <p className="mt-2 text-sm text-muted">Every question must be correct to pass — unlimited retries, no cooldown.</p>

      <div className="mt-7">
        <QuizTaker
          quiz={quiz}
          variant="module"
          onSubmit={(answers) => courseApi.attemptModuleQuiz(slug, moduleId, answers)}
          onPassed={() => setPassed(true)}
        />
      </div>

      {passed && (
        <Link
          href={`/courses/${slug}/learn`}
          className="mt-7 inline-block rounded-lg border border-border-strong px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:border-accent-dim hover:text-navy"
        >
          back to modules
        </Link>
      )}
    </main>
  );
}
