"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { QuizTaker } from "@/components/QuizTaker";
import { courseApi, type QuizForAttempt } from "@/lib/api";

export default function FinalExamTakePage() {
  const { slug } = useParams<{ slug: string }>();
  const [quiz, setQuiz] = useState<QuizForAttempt | null | undefined>(undefined);
  const [passed, setPassed] = useState(false);
  const [capstonePending, setCapstonePending] = useState(false);

  function handlePassed() {
    setPassed(true);
    courseApi
      .progress(slug)
      .then((result) => {
        setCapstonePending(Boolean(result.capstone_status && result.capstone_status !== "approved"));
      })
      .catch(() => {
        // no capstone info available — the congratulations state below still applies
      });
  }

  useEffect(() => {
    let active = true;
    courseApi
      .finalExamQuestions(slug)
      .then((result) => {
        if (active) setQuiz(result);
      })
      .catch(() => {
        if (active) setQuiz(null);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  if (quiz === undefined) return null;

  if (!quiz) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em]">Not ready yet</h1>
          <Link href={`/courses/${slug}/learn/final-exam`} className="mt-3 inline-block text-navy hover:underline">
            Back to intro
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-10">
      <h1 className="text-[clamp(24px,3.6vw,36px)] tracking-[-0.03em]">Final exam</h1>

      <div className="mt-7">
        <QuizTaker
          quiz={quiz}
          variant="final"
          onSubmit={(answers) => courseApi.attemptFinalExam(slug, answers)}
          onPassed={handlePassed}
        />
      </div>

      {passed && capstonePending && (
        <Link
          href={`/courses/${slug}/learn/capstone`}
          className="mt-7 inline-block rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
        >
          Submit capstone project
        </Link>
      )}

      {passed && !capstonePending && (
        <div className="mt-7 rounded-lg border border-border-strong bg-navy/[0.04] px-5 py-4">
          <div className="font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-navy">Congratulations ✓</div>
          <div className="mt-1 text-sm text-muted">You&apos;ve passed the final exam and finished the course.</div>
          <Link
            href={`/courses/${slug}/learn`}
            className="mt-4 inline-block rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
          >
            Back to course
          </Link>
        </div>
      )}
    </main>
  );
}
