"use client";

import { useState } from "react";
import { ApiError, adminApi, type ChoiceItem } from "@/lib/api";
import { buildCourseAiPrompt } from "@/lib/aiCoursePrompt";

type AiQuestion = {
  prompt: string;
  choices: ChoiceItem[];
  correct_choice_id: string;
  explanation?: string | null;
};

type AiQuiz = { title?: string; pass_threshold_pct?: number; questions?: AiQuestion[] };

type AiLesson = { title: string; body?: string; video_url?: string | null };

type AiModule = { title: string; summary?: string | null; lessons?: AiLesson[]; quiz?: AiQuiz };

type AiFinalExam = { title?: string; intro_text?: string | null; pass_threshold_pct?: number; questions?: AiQuestion[] };

type AiCoursePlan = { modules: AiModule[]; final_exam?: AiFinalExam };

export function CourseAiImportPanel({
  slug,
  title,
  description,
  onImported,
}: {
  slug: string;
  title: string;
  description: string;
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function copyPrompt() {
    await navigator.clipboard.writeText(buildCourseAiPrompt(title, description));
    setCopied(true);
  }

  function parsePlan(raw: string): AiCoursePlan {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("That's not valid JSON — paste the AI's output exactly, with no extra text around it.");
    }
    const plan = data as Partial<AiCoursePlan>;
    if (!plan || !Array.isArray(plan.modules) || plan.modules.length === 0) {
      throw new Error("Expected a \"modules\" array with at least one module.");
    }
    return plan as AiCoursePlan;
  }

  async function runImport() {
    setBusy(true);
    setError(null);
    setLog([]);
    const append = (line: string) => setLog((l) => [...l, line]);

    try {
      const plan = parsePlan(json);

      for (const m of plan.modules) {
        append(`Creating module "${m.title}"…`);
        const createdModule = await adminApi.createModule(slug, { title: m.title, summary: m.summary ?? null });

        for (const l of m.lessons ?? []) {
          await adminApi.createLesson(createdModule.id, {
            title: l.title,
            body: l.body ?? "",
            video_url: l.video_url ?? null,
          });
        }
        append(`  + ${m.lessons?.length ?? 0} lesson${(m.lessons?.length ?? 0) === 1 ? "" : "s"}`);

        if (m.quiz) {
          const quiz = await adminApi.createModuleQuiz(createdModule.id, {
            title: m.quiz.title || "Module Quiz",
            intro_text: null,
            pass_threshold_pct: m.quiz.pass_threshold_pct ?? 80,
          });
          for (const q of m.quiz.questions ?? []) {
            await adminApi.createQuestion(quiz.id, {
              prompt: q.prompt,
              choices: q.choices,
              correct_choice_id: q.correct_choice_id,
              explanation: q.explanation ?? null,
            });
          }
          append(`  + quiz with ${m.quiz.questions?.length ?? 0} question${(m.quiz.questions?.length ?? 0) === 1 ? "" : "s"}`);
        }
      }

      if (plan.final_exam) {
        append("Creating final exam…");
        const exam = await adminApi.createFinalExam(slug, {
          title: plan.final_exam.title || "Final Exam",
          intro_text: plan.final_exam.intro_text ?? null,
          pass_threshold_pct: plan.final_exam.pass_threshold_pct ?? 70,
        });
        for (const q of plan.final_exam.questions ?? []) {
          await adminApi.createQuestion(exam.id, {
            prompt: q.prompt,
            choices: q.choices,
            correct_choice_id: q.correct_choice_id,
            explanation: q.explanation ?? null,
          });
        }
        append(`  + ${plan.final_exam.questions?.length ?? 0} questions`);
      }

      append("Done — review every module, lesson, and answer before publishing.");
      setJson("");
      onImported();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Import failed partway through — whatever was already created is still there; check the course below."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">generate with ai</div>
          <p className="mt-1.5 text-[13.5px] text-muted">
            Get a prompt to paste into an AI tool, then paste its JSON output back here to bulk-create modules, lessons,
            and quizzes.
          </p>
        </div>
        <span className="font-mono text-lg text-faint">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-5 flex flex-col gap-5 border-t border-border pt-5">
          <div>
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">1. copy this prompt</div>
              <button
                type="button"
                onClick={copyPrompt}
                className="rounded-md border border-accent-dim px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-navy"
              >
                {copied ? "copied ✓" : "copy prompt"}
              </button>
            </div>
            <textarea
              readOnly
              value={buildCourseAiPrompt(title, description)}
              rows={6}
              onFocus={(e) => e.target.select()}
              className="mt-2 w-full resize-y rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-[11.5px] leading-[1.5] text-muted outline-none focus:border-accent"
            />
            <p className="mt-1.5 text-[12px] text-faint">
              Paste it into Claude, ChatGPT, or similar. It asks for a complete roadmap, self-contained modules, and a
              30-50 question final exam — returned as JSON.
            </p>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">2. paste its JSON output</div>
            <textarea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder='{ "modules": [ ... ], "final_exam": { ... } }'
              rows={6}
              className="mt-2 w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-[11.5px] outline-none focus:border-accent"
            />
            <p className="mt-1.5 text-[12px] text-faint">
              Review every question and any links the AI included before publishing — it can&apos;t actually verify a URL
              is live, only avoid guessing ones it&apos;s unsure of.
            </p>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          {log.length > 0 && (
            <div className="rounded-md border border-border-strong bg-background p-3 font-mono text-[11.5px] leading-[1.6] text-muted">
              {log.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={runImport}
            disabled={busy || !json.trim()}
            className="w-fit rounded-md bg-accent px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744] disabled:opacity-50"
          >
            {busy ? "Importing…" : "Import into this course"}
          </button>
        </div>
      )}
    </div>
  );
}
