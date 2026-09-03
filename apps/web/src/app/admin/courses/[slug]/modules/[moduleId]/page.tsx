"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { QuizQuestionBuilder } from "@/components/QuizQuestionBuilder";
import { useConfirm } from "@/components/ConfirmDialog";
import { ApiError, adminApi, type AdminLessonRow, type AdminModuleRow, type AdminQuizRow } from "@/lib/api";

export default function ManageModulePage() {
  const { slug, moduleId } = useParams<{ slug: string; moduleId: string }>();
  const [module, setModule] = useState<AdminModuleRow | null>(null);
  const [lessons, setLessons] = useState<AdminLessonRow[] | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const confirm = useConfirm();

  const [editing, setEditing] = useState<AdminLessonRow | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [lessonBusy, setLessonBusy] = useState(false);
  const [bodyTab, setBodyTab] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState<"image" | "attachment" | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [quiz, setQuiz] = useState<AdminQuizRow | null | undefined>(undefined);
  const [quizTitle, setQuizTitle] = useState("Module Quiz");
  const [quizBusy, setQuizBusy] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  async function loadLessons() {
    setLessons(await adminApi.listLessons(moduleId));
  }

  useEffect(() => {
    let active = true;
    adminApi.listModules(slug).then((modules) => {
      if (active) setModule(modules.find((m) => m.id === moduleId) ?? null);
    });
    adminApi.listLessons(moduleId).then((result) => {
      if (active) setLessons(result);
    });
    adminApi.getModuleQuiz(moduleId).then((q) => {
      if (!active) return;
      setQuiz(q);
      if (q) setQuizTitle(q.title);
    });
    return () => {
      active = false;
    };
  }, [slug, moduleId]);

  function startEdit(lesson: AdminLessonRow) {
    setEditing(lesson);
    setNewTitle(lesson.title);
    setNewBody(lesson.body);
    setNewVideoUrl(lesson.video_url ?? "");
  }

  function startNew() {
    setEditing(null);
    setNewTitle("");
    setNewBody("");
    setNewVideoUrl("");
    setBodyTab("write");
  }

  function insertAtCursor(text: string) {
    const el = bodyRef.current;
    if (!el) {
      setNewBody((b) => b + text);
      return;
    }
    const start = el.selectionStart ?? newBody.length;
    const end = el.selectionEnd ?? newBody.length;
    const updated = newBody.slice(0, start) + text + newBody.slice(end);
    setNewBody(updated);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  }

  async function handleUpload(kind: "image" | "attachment", file: File) {
    setUploading(kind);
    setUploadError(null);
    try {
      const { url } = await adminApi.uploadFile(file);
      insertAtCursor(kind === "image" ? `![${file.name}](${url})` : `[${file.name}](${url})`);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Couldn't upload file.");
    } finally {
      setUploading(null);
    }
  }

  async function saveLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setLessonBusy(true);
    setLessonError(null);
    try {
      const payload = { title: newTitle.trim(), body: newBody, video_url: newVideoUrl.trim() || null };
      if (editing) {
        await adminApi.updateLesson(editing.id, payload);
      } else {
        await adminApi.createLesson(moduleId, payload);
      }
      startNew();
      await loadLessons();
    } catch (err) {
      setLessonError(err instanceof ApiError ? err.message : "Couldn't save lesson.");
    } finally {
      setLessonBusy(false);
    }
  }

  async function removeLesson(id: string, title: string) {
    const ok = await confirm({ title: "Delete lesson?", message: `"${title}" will be permanently deleted.` });
    if (!ok) return;
    setLessonError(null);
    try {
      await adminApi.deleteLesson(id);
      if (editing?.id === id) startNew();
      await loadLessons();
    } catch (err) {
      setLessonError(err instanceof ApiError ? err.message : "Couldn't delete lesson.");
    }
  }

  async function reorderLesson(id: string, direction: "up" | "down") {
    await adminApi.reorderLesson(id, direction);
    await loadLessons();
  }

  async function saveQuiz(e: React.FormEvent) {
    e.preventDefault();
    setQuizBusy(true);
    setQuizError(null);
    try {
      if (quiz) {
        const updated = await adminApi.updateQuiz(quiz.id, { title: quizTitle.trim() });
        setQuiz(updated);
      } else {
        // pass_threshold_pct is meaningless for module quizzes — grading
        // always requires a perfect score regardless of this column — so
        // it's sent as a constant rather than exposed as an input here.
        const created = await adminApi.createModuleQuiz(moduleId, {
          title: quizTitle.trim(),
          intro_text: null,
          pass_threshold_pct: 100,
        });
        setQuiz(created);
      }
    } catch (err) {
      setQuizError(err instanceof ApiError ? err.message : "Couldn't save quiz.");
    } finally {
      setQuizBusy(false);
    }
  }

  if (!module || lessons === null || quiz === undefined) return null;

  return (
    <div className="max-w-5xl">
      <Link href={`/admin/courses/${slug}/edit`} className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted hover:text-navy">
        ← back to course
      </Link>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">{module.title}</h1>

      <div className="mt-6.5 rounded-xl border border-border bg-surface p-6">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">lessons</div>

        <div className="mt-4.5 flex flex-col gap-2">
          {lessons.length === 0 && <p className="text-sm text-muted">No lessons yet.</p>}
          {lessons.map((l, i) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border-strong bg-background px-4 py-3">
              <div className="min-w-40 flex-1 text-sm font-medium">{l.title}</div>
              <div className="flex gap-1.5">
                <button onClick={() => reorderLesson(l.id, "up")} disabled={i === 0} className="rounded-md border border-border-strong px-2 py-1 text-xs text-muted disabled:opacity-30">↑</button>
                <button onClick={() => reorderLesson(l.id, "down")} disabled={i === lessons.length - 1} className="rounded-md border border-border-strong px-2 py-1 text-xs text-muted disabled:opacity-30">↓</button>
              </div>
              <button onClick={() => startEdit(l)} className="rounded-md border border-border-strong px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                edit
              </button>
              <button onClick={() => removeLesson(l.id, l.title)} className="rounded-md border border-[#f6d9d6] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-danger">
                delete
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={saveLesson} className="mt-5 flex flex-col gap-3 border-t border-border pt-4.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{editing ? `editing "${editing.title}"` : "new lesson"}</div>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Lesson title"
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1.5 lg:hidden">
                <button
                  type="button"
                  onClick={() => setBodyTab("write")}
                  className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] ${
                    bodyTab === "write" ? "border-accent-dim bg-accent/[0.08] text-navy" : "border-border-strong text-muted"
                  }`}
                >
                  write
                </button>
                <button
                  type="button"
                  onClick={() => setBodyTab("preview")}
                  className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] ${
                    bodyTab === "preview" ? "border-accent-dim bg-accent/[0.08] text-navy" : "border-border-strong text-muted"
                  }`}
                >
                  preview
                </button>
              </div>
              <div className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-faint lg:block">write · live preview</div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploading !== null}
                  className="rounded-md border border-border-strong px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted disabled:opacity-50"
                >
                  {uploading === "image" ? "uploading…" : "+ image"}
                </button>
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={uploading !== null}
                  className="rounded-md border border-border-strong px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted disabled:opacity-50"
                >
                  {uploading === "attachment" ? "uploading…" : "+ attachment"}
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) handleUpload("image", file);
                  }}
                />
                <input
                  ref={attachmentInputRef}
                  type="file"
                  accept=".pdf,.zip,.txt,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) handleUpload("attachment", file);
                  }}
                />
              </div>
            </div>

            <div className="lg:grid lg:grid-cols-2 lg:gap-4">
              <textarea
                ref={bodyRef}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Lesson content — markdown supported (headings, lists, images, ```mermaid fences for diagrams)"
                rows={14}
                className={`w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent lg:block ${
                  bodyTab === "write" ? "block" : "hidden"
                }`}
              />
              <div
                className={`mt-2 min-h-40 w-full overflow-y-auto rounded-md border border-border-strong bg-background px-4 py-3 lg:mt-0 lg:block lg:min-h-[23rem] ${
                  bodyTab === "preview" ? "block" : "hidden"
                }`}
              >
                {newBody.trim() ? <Markdown>{newBody}</Markdown> : <p className="text-sm text-muted">Nothing to preview yet.</p>}
              </div>
            </div>
            {uploadError && <p className="text-sm text-danger">{uploadError}</p>}
          </div>
          <input
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            placeholder="Video URL (optional, e.g. a YouTube link)"
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          {lessonError && <p className="text-sm text-danger">{lessonError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={lessonBusy}
              className="w-fit rounded-md bg-accent px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744] disabled:opacity-50"
            >
              {lessonBusy ? "Saving…" : editing ? "Save lesson" : "+ add lesson"}
            </button>
            {editing && (
              <button type="button" onClick={startNew} className="w-fit rounded-md border border-border-strong px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
                cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">module quiz</div>
        <p className="mt-2 text-[13.5px] text-muted">
          Short, auto-graded — passing this unlocks the next module. A perfect score is required; there&apos;s no
          partial-credit threshold for module quizzes.
        </p>

        <form onSubmit={saveQuiz} className="mt-4.5 flex flex-col gap-3.5">
          <input
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          {quizError && <p className="text-sm text-danger">{quizError}</p>}
          <button
            type="submit"
            disabled={quizBusy}
            className="w-fit rounded-md bg-accent px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744] disabled:opacity-50"
          >
            {quizBusy ? "Saving…" : quiz ? "Save quiz details" : "Create quiz"}
          </button>
        </form>

        {quiz && (
          <div className="mt-5.5 border-t border-border pt-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">questions</div>
            <div className="mt-3">
              <QuizQuestionBuilder quizId={quiz.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
