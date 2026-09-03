"use client";

import { useState } from "react";
import { ApiError, type AnswerItem, type QuizAttemptResult, type QuizForAttempt } from "@/lib/api";

type Props = {
  quiz: QuizForAttempt;
  variant: "module" | "final";
  onSubmit: (answers: AnswerItem[]) => Promise<QuizAttemptResult>;
  onPassed?: () => void;
};

export function QuizTaker({ quiz, variant, onSubmit, onPassed }: Props) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = quiz.questions.every((q) => (answers[q.id]?.length ?? 0) > 0);

  function selectSingle(questionId: string, choiceId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: [choiceId] }));
  }

  function toggleMulti(questionId: string, choiceId: string) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const next = current.includes(choiceId) ? current.filter((id) => id !== choiceId) : [...current, choiceId];
      return { ...prev, [questionId]: next };
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const graded = await onSubmit(
        Object.entries(answers).map(([question_id, choice_ids]) => ({ question_id, choice_ids }))
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
                  const isCorrect = a.correct_choice_ids.includes(c.id);
                  const isSubmitted = a.submitted_choice_ids.includes(c.id);
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
          {q.multi_select && <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">select all that apply</div>}
          <div className="mt-3 flex flex-col gap-1.5">
            {q.choices.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5 text-[13.5px]">
                <input
                  type={q.multi_select ? "checkbox" : "radio"}
                  name={q.multi_select ? undefined : q.id}
                  checked={(answers[q.id] ?? []).includes(c.id)}
                  onChange={() => (q.multi_select ? toggleMulti(q.id, c.id) : selectSingle(q.id, c.id))}
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
