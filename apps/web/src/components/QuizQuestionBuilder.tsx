"use client";

import { useEffect, useState } from "react";
import { ApiError, adminApi, type AdminQuestionRow, type ChoiceItem } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";

export function QuizQuestionBuilder({ quizId }: { quizId: string }) {
  const [questions, setQuestions] = useState<AdminQuestionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    adminApi.listQuestions(quizId).then(setQuestions);
  }, [quizId]);

  async function refresh() {
    setQuestions(await adminApi.listQuestions(quizId));
  }

  async function addQuestion() {
    setError(null);
    try {
      await adminApi.createQuestion(quizId, {
        prompt: "New question",
        choices: [
          { id: "a", text: "" },
          { id: "b", text: "" },
        ],
        correct_choice_id: "a",
        explanation: null,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add question.");
    }
  }

  async function removeQuestion(id: string) {
    const ok = await confirm({ title: "Delete question?", message: "This can't be undone." });
    if (!ok) return;
    await adminApi.deleteQuestion(id);
    await refresh();
  }

  async function reorder(id: string, direction: "up" | "down") {
    await adminApi.reorderQuestion(id, direction);
    await refresh();
  }

  if (!questions) return null;

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      {questions.length === 0 && <p className="text-sm text-muted">No questions yet.</p>}
      {questions.map((q, i) => (
        <QuestionEditor
          key={q.id}
          question={q}
          isFirst={i === 0}
          isLast={i === questions.length - 1}
          onSaved={refresh}
          onDelete={() => removeQuestion(q.id)}
          onReorder={(direction) => reorder(q.id, direction)}
        />
      ))}
      <button
        type="button"
        onClick={addQuestion}
        className="w-fit rounded-md border border-border-strong px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted"
      >
        + add question
      </button>
    </div>
  );
}

function QuestionEditor({
  question,
  isFirst,
  isLast,
  onSaved,
  onDelete,
  onReorder,
}: {
  question: AdminQuestionRow;
  isFirst: boolean;
  isLast: boolean;
  onSaved: () => void;
  onDelete: () => void;
  onReorder: (direction: "up" | "down") => void;
}) {
  const [prompt, setPrompt] = useState(question.prompt);
  const [choices, setChoices] = useState<ChoiceItem[]>(question.choices);
  const [correctChoiceId, setCorrectChoiceId] = useState(question.correct_choice_id);
  const [explanation, setExplanation] = useState(question.explanation ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateChoice(i: number, text: string) {
    setChoices((cs) => cs.map((c, idx) => (idx === i ? { ...c, text } : c)));
    setSaved(false);
  }

  function addChoice() {
    if (choices.length >= 5) return;
    const nextId = String.fromCharCode(97 + choices.length); // a, b, c, …
    setChoices((cs) => [...cs, { id: nextId, text: "" }]);
    setSaved(false);
  }

  function removeChoice(i: number) {
    if (choices.length <= 2) return;
    const removed = choices[i];
    const next = choices.filter((_, idx) => idx !== i);
    setChoices(next);
    if (correctChoiceId === removed.id) setCorrectChoiceId(next[0].id);
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await adminApi.updateQuestion(question.id, {
        prompt: prompt.trim(),
        choices,
        correct_choice_id: correctChoiceId,
        explanation: explanation.trim() || null,
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save question.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border-strong bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setSaved(false);
          }}
          rows={2}
          className="flex-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onReorder("up")}
            disabled={isFirst}
            className="rounded-md border border-border-strong px-2 py-1 text-xs text-muted disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onReorder("down")}
            disabled={isLast}
            className="rounded-md border border-border-strong px-2 py-1 text-xs text-muted disabled:opacity-30"
          >
            ↓
          </button>
          <button type="button" onClick={onDelete} className="rounded-md border border-[#f6d9d6] px-2 py-1 text-xs text-danger">
            ×
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">select the correct choice</div>
        {choices.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${question.id}`}
              checked={correctChoiceId === c.id}
              onChange={() => {
                setCorrectChoiceId(c.id);
                setSaved(false);
              }}
              className="accent-accent"
            />
            <input
              value={c.text}
              onChange={(e) => updateChoice(i, e.target.value)}
              placeholder={`Choice ${c.id}`}
              className="flex-1 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
            {choices.length > 2 && (
              <button type="button" onClick={() => removeChoice(i)} className="rounded-md border border-border-strong px-2 py-1 text-xs text-muted">
                ×
              </button>
            )}
          </div>
        ))}
        {choices.length < 5 && (
          <button
            type="button"
            onClick={addChoice}
            className="w-fit font-mono text-[10px] uppercase tracking-[0.08em] text-muted"
          >
            + add choice
          </button>
        )}
      </div>

      <textarea
        value={explanation}
        onChange={(e) => {
          setExplanation(e.target.value);
          setSaved(false);
        }}
        placeholder="Explanation shown after grading (optional)"
        rows={2}
        className="mt-3 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-3 rounded-md bg-accent px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744] disabled:opacity-50"
      >
        {busy ? "Saving…" : saved ? "Saved ✓" : "Save question"}
      </button>
    </div>
  );
}
