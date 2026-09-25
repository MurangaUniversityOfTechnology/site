"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError, adminApi, type QuizQuestion } from "@/lib/api";
import { CHOICE_STYLES, ChoiceShape } from "@/components/games/choices";

const INPUT = "w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent";
const LABEL = "font-mono text-[10px] uppercase tracking-[0.12em] text-faint";
const TIME_LIMITS = [10, 20, 30, 45, 60, 90];

const blankQuestion = (): QuizQuestion => ({ prompt: "", choices: ["", "", "", ""], correct: [0], time_limit: 20 });

export default function EditGameQuizPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(isNew ? [blankQuestion()] : null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isNew) return;
    adminApi.getGameQuiz(id).then((quiz) => {
      setTitle(quiz.title);
      setDescription(quiz.description ?? "");
      // Pad to 4 slots so every question edits the same way; blanks are
      // dropped again on save.
      setQuestions(quiz.questions.map((q) => ({ ...q, choices: [...q.choices, "", "", ""].slice(0, 4) })));
    });
  }, [id, isNew]);

  function update(index: number, patch: Partial<QuizQuestion>) {
    setSaved(false);
    setQuestions((qs) => qs!.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function move(index: number, delta: number) {
    setQuestions((qs) => {
      const next = [...qs!];
      const [q] = next.splice(index, 1);
      next.splice(index + delta, 0, q);
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!questions) return;
    setSaving(true);
    setError(null);
    // Drop blank choice slots, remapping the correct indexes to match.
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      questions: questions.map((q) => {
        const kept = q.choices.map((c, i) => ({ c: c.trim(), i })).filter((x) => x.c);
        return {
          ...q,
          choices: kept.map((x) => x.c),
          correct: kept.flatMap((x, newIndex) => (q.correct.includes(x.i) ? [newIndex] : [])),
        };
      }),
    };
    try {
      if (isNew) {
        const quiz = await adminApi.createGameQuiz(payload);
        router.replace(`/admin/games/quizzes/${quiz.id}`);
      } else {
        await adminApi.updateGameQuiz(id, payload);
        setSaved(true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the quiz.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-220">
      <Link href="/admin/games" className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-muted">
        ← games
      </Link>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">{isNew ? "New live quiz" : title || "Live quiz"}</h1>
      <p className="mt-2.5 max-w-140 text-[14px] leading-[1.55] text-muted">
        2–4 choices per question. Tick more than one correct choice to make it a &ldquo;select all that apply&rdquo; question,
        where players only score if they pick exactly the right set. Mix a few of those in.
      </p>

      {questions === null ? (
        <p className="mt-8 text-sm text-faint">Loading…</p>
      ) : (
        <form onSubmit={save} className="mt-7 flex flex-col gap-5">
          <div className="grid gap-4 rounded-xl border border-border bg-surface p-5.5 sm:grid-cols-2">
            <label className="block">
              <div className={LABEL}>Title</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder="e.g. Git & GitHub warm-up" className={`mt-1.5 ${INPUT}`} />
            </label>
            <label className="block">
              <div className={LABEL}>Description (optional)</div>
              <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="For your own reference" className={`mt-1.5 ${INPUT}`} />
            </label>
          </div>

          {questions.map((q, qi) => (
            <fieldset key={qi} className="rounded-xl border border-border-strong bg-surface p-5.5">
              <div className="flex flex-wrap items-center gap-2">
                <legend className="mr-auto font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                  Question {qi + 1}
                  {q.correct.length > 1 && <span className="ml-2 text-accent-dim">· select all that apply</span>}
                </legend>
                <select
                  value={q.time_limit}
                  onChange={(e) => update(qi, { time_limit: Number(e.target.value) })}
                  aria-label="Time limit"
                  className="rounded-md border border-border-strong bg-background px-2.5 py-1.5 font-mono text-[11px]"
                >
                  {TIME_LIMITS.map((t) => (
                    <option key={t} value={t}>
                      {t}s
                    </option>
                  ))}
                </select>
                <button type="button" disabled={qi === 0} onClick={() => move(qi, -1)} aria-label="Move up" className="rounded-md border border-border-strong px-2.5 py-1 text-muted disabled:opacity-30">
                  ↑
                </button>
                <button type="button" disabled={qi === questions.length - 1} onClick={() => move(qi, 1)} aria-label="Move down" className="rounded-md border border-border-strong px-2.5 py-1 text-muted disabled:opacity-30">
                  ↓
                </button>
                <button
                  type="button"
                  disabled={questions.length === 1}
                  onClick={() => setQuestions((qs) => qs!.filter((_, i) => i !== qi))}
                  className="rounded-md border border-[#f6d9d6] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-danger disabled:opacity-30"
                >
                  remove
                </button>
              </div>

              <textarea
                value={q.prompt}
                onChange={(e) => update(qi, { prompt: e.target.value })}
                required
                maxLength={300}
                rows={2}
                placeholder="What does `git status` show?"
                className={`mt-3.5 ${INPUT} resize-y text-[15px]`}
              />

              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {q.choices.map((choice, ci) => {
                  const correct = q.correct.includes(ci);
                  return (
                    <div key={ci} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${correct ? "border-accent-dim bg-accent/[0.08]" : "border-border"}`}>
                      <span className={`grid h-8 w-8 flex-none place-items-center rounded-md text-[14px] ${CHOICE_STYLES[ci].tile}`}>
                        <ChoiceShape index={ci} />
                      </span>
                      <input
                        value={choice}
                        onChange={(e) => update(qi, { choices: q.choices.map((c, i) => (i === ci ? e.target.value : c)) })}
                        placeholder={ci < 2 ? `Choice ${ci + 1}` : `Choice ${ci + 1} (optional)`}
                        maxLength={120}
                        className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none"
                      />
                      <label className="flex flex-none cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                        <input
                          type="checkbox"
                          checked={correct}
                          onChange={() =>
                            update(qi, { correct: correct ? q.correct.filter((i) => i !== ci) : [...q.correct, ci].sort() })
                          }
                          className="accent-[#ad8a45]"
                        />
                        correct
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <button
            type="button"
            onClick={() => setQuestions((qs) => [...qs!, blankQuestion()])}
            disabled={questions.length >= 50}
            className="rounded-xl border border-dashed border-border-strong py-3.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted hover:border-accent-dim hover:text-foreground"
          >
            + add question
          </button>

          <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-1 py-4 backdrop-blur">
            <button type="submit" disabled={saving} className="rounded-md bg-accent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-navy hover:opacity-90 disabled:opacity-50">
              {saving ? "saving…" : isNew ? "create quiz" : "save changes"}
            </button>
            <span className="font-mono text-[11px] text-faint">
              {questions.length} question{questions.length === 1 ? "" : "s"}
            </span>
            {saved && <span className="text-[13px] text-accent-dim">Saved ✓</span>}
            {error && <span className="text-[13px] text-danger">{error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
