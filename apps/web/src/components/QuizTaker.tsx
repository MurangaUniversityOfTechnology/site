"use client";

import { useState } from "react";
import { ApiError, type QuizAttemptResult, type QuizForAttempt } from "@/lib/api";

type Props = {
  quiz: QuizForAttempt;
  variant: "module" | "final";
  onSubmit: (answers: { question_id: string; choice_id: string }[]) => Promise<QuizAttemptResult>;
  onPassed?: () => void;
};

export function QuizTaker({ quiz, variant, onSubmit, onPassed }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = quiz.questions.every((q) => answers[q.id]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const graded = await onSubmit(
        Object.entries(answers).map(([question_id, choice_id]) => ({ question_id, choice_id }))
      );
      setResult(graded);
      if (graded.passed) onPassed?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    setResult(null);
    setAnswers({});
    setError(null);
  }

  if (result) {
    return (
      <div className="flex flex-col gap-5">
        <div
          className={`rounded-lg border px-5 py-4 ${
            result.passed ? "border-border-strong bg-navy/[0.04]" : "border-[#f0c9c4] bg-danger/[0.05]"
          }`}
        >
          <div className={`font-mono text-[13px] font-semibold uppercase tracking-[0.08em] ${result.passed ? "text-navy" : "text-danger"}`}>
            {result.passed ? "Passed ✓" : "Not this time"}
          </div>
          <div className="mt-1 text-sm text-muted">
            Score: {Math.round(result.score_pct)}% · needed {quiz.pass_threshold_pct}%
            {variant === "module" && !result.passed && " — every question must be correct."}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {result.answers.map((a, i) => (
            <div
              key={a.question_id}
              className={`rounded-lg border px-4 py-3.5 ${a.correct ? "border-border-strong" : "border-[#f0c9c4] bg-danger/[0.04]"}`}
            >
              <div className="text-sm font-medium">
                {i + 1}. {a.prompt}
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {a.choices.map((c) => {
                  const isCorrect = c.id === a.correct_choice_id;
                  const isSubmitted = c.id === a.submitted_choice_id;
                  return (
                    <div
                      key={c.id}
                      className={`text-[13.5px] ${isCorrect ? "font-semibold text-navy" : isSubmitted ? "text-danger" : "text-muted"}`}
                    >
                      {isCorrect ? "✓ " : isSubmitted ? "✗ " : "· "}
                      {c.text}
                    </div>
                  );
                })}
              </div>
              {a.explanation && <div className="mt-2 text-[13px] text-muted">{a.explanation}</div>}
            </div>
          ))}
        </div>

        {!result.passed && (
          <button
            onClick={retry}
            className="w-fit rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {quiz.questions.map((q, i) => (
        <div key={q.id} className="rounded-lg border border-border-strong bg-surface px-4 py-3.5">
          <div className="text-sm font-medium">
            {i + 1}. {q.prompt}
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {q.choices.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5 text-[13.5px]">
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === c.id}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: c.id }))}
                  className="accent-accent"
                />
                {c.text}
              </label>
            ))}
          </div>
        </div>
      ))}
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        onClick={submit}
        disabled={!allAnswered || submitting}
        className="w-fit rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Grading…" : "Submit"}
      </button>
    </div>
  );
}
