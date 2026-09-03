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
          onPassed={() => setPassed(true)}
        />
      </div>

      {passed && (
        <Link
          href={`/courses/${slug}/certificate`}
          className="mt-7 inline-block rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
        >
          View certificate
        </Link>
      )}
    </main>
  );
}
