"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CourseForm, type CourseFormValues, valuesToPayload } from "@/components/CourseForm";
import { QuizQuestionBuilder } from "@/components/QuizQuestionBuilder";
import { CourseAiImportPanel } from "@/components/CourseAiImportPanel";
import { useConfirm } from "@/components/ConfirmDialog";
import { ApiError, adminApi, type AdminCourseRow, type AdminModuleRow, type AdminQuizRow } from "@/lib/api";

export default function EditCoursePage() {
  const { slug } = useParams<{ slug: string }>();
  const [course, setCourse] = useState<AdminCourseRow | null>(null);
  const [values, setValues] = useState<CourseFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [modules, setModules] = useState<AdminModuleRow[] | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const confirm = useConfirm();

  const [finalExam, setFinalExam] = useState<AdminQuizRow | null | undefined>(undefined);
  const [examTitle, setExamTitle] = useState("Final Exam");
  const [examIntro, setExamIntro] = useState(
    "This is a long, comprehensive exam (30-50 questions) — budget real time for it. There's no going back once you start."
  );
  const [examThreshold, setExamThreshold] = useState("70");
  const [examBusy, setExamBusy] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);

  async function loadCourse() {
    const rows = await adminApi.listCourses(false);
    const found = rows.find((c) => c.slug === slug) ?? null;
    setCourse(found);
    if (found) {
      setValues({
        slug: found.slug,
        title: found.title,
        shortDescription: found.short_description,
        description: found.description,
        coverImageUrl: found.cover_image_url ?? "",
        priceKes: String(found.price_kes),
      });
    }
  }

  async function loadModules() {
    setModules(await adminApi.listModules(slug));
  }

  async function loadFinalExam() {
    const exam = await adminApi.getFinalExam(slug);
    setFinalExam(exam);
    if (exam) {
      setExamTitle(exam.title);
      setExamIntro(exam.intro_text ?? "");
      setExamThreshold(String(exam.pass_threshold_pct));
    }
  }

  async function refreshAfterAiImport() {
    await loadModules();
    await loadFinalExam();
  }

  useEffect(() => {
    let active = true;
    adminApi.listCourses(false).then((rows) => {
      if (!active) return;
      const found = rows.find((c) => c.slug === slug) ?? null;
      setCourse(found);
      if (found) {
        setValues({
          slug: found.slug,
          title: found.title,
          shortDescription: found.short_description,
          description: found.description,
          coverImageUrl: found.cover_image_url ?? "",
          priceKes: String(found.price_kes),
        });
      }
    });
    adminApi.listModules(slug).then((result) => {
      if (active) setModules(result);
    });
    adminApi.getFinalExam(slug).then((exam) => {
      if (!active) return;
      setFinalExam(exam);
      if (exam) {
        setExamTitle(exam.title);
        setExamIntro(exam.intro_text ?? "");
        setExamThreshold(String(exam.pass_threshold_pct));
      }
    });
    return () => {
      active = false;
    };
  }, [slug]);

  async function saveCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await adminApi.updateCourse(slug, valuesToPayload(values));
      setSaved(true);
      await loadCourse();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save course.");
    } finally {
      setSaving(false);
    }
  }

  async function addModule(e: React.FormEvent) {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    setModuleError(null);
    try {
      await adminApi.createModule(slug, { title: newModuleTitle.trim(), summary: null });
      setNewModuleTitle("");
      await loadModules();
    } catch (err) {
      setModuleError(err instanceof ApiError ? err.message : "Couldn't add module.");
    }
  }

  async function removeModule(id: string, title: string) {
    const ok = await confirm({ title: "Delete module?", message: `"${title}" and its lessons/quiz will be permanently deleted.` });
    if (!ok) return;
    setModuleError(null);
    try {
      await adminApi.deleteModule(id);
      await loadModules();
    } catch (err) {
      setModuleError(err instanceof ApiError ? err.message : "Couldn't delete module.");
    }
  }

  async function reorderModule(id: string, direction: "up" | "down") {
    await adminApi.reorderModule(id, direction);
    await loadModules();
  }

  async function publish() {
    setPublishError(null);
    try {
      const updated = await adminApi.publishCourse(slug);
      setCourse(updated);
    } catch (err) {
      setPublishError(err instanceof ApiError ? err.message : "Couldn't publish course.");
    }
  }

  async function unpublish() {
    setPublishError(null);
    try {
      const updated = await adminApi.unpublishCourse(slug);
      setCourse(updated);
    } catch (err) {
      setPublishError(err instanceof ApiError ? err.message : "Couldn't unpublish course.");
    }
  }

  async function saveFinalExam(e: React.FormEvent) {
    e.preventDefault();
    setExamBusy(true);
    setExamError(null);
    try {
      if (finalExam) {
        const updated = await adminApi.updateQuiz(finalExam.id, {
          title: examTitle.trim(),
          intro_text: examIntro.trim() || null,
          pass_threshold_pct: Number(examThreshold) || 70,
        });
        setFinalExam(updated);
      } else {
        const created = await adminApi.createFinalExam(slug, {
          title: examTitle.trim(),
          intro_text: examIntro.trim() || null,
          pass_threshold_pct: Number(examThreshold) || 70,
        });
        setFinalExam(created);
      }
    } catch (err) {
      setExamError(err instanceof ApiError ? err.message : "Couldn't save final exam.");
    } finally {
      setExamBusy(false);
    }
  }

  if (!course || !values || modules === null || finalExam === undefined) return null;

  return (
    <div className="max-w-160">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">courses</div>
      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <h1 className="text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">{course.title}</h1>
        <span
          className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.08em] ${
            course.published_at ? "bg-accent/[0.12] text-navy" : "border border-border-strong text-muted"
          }`}
        >
          {course.published_at ? "published" : "draft"}
        </span>
      </div>

      <div className="mt-6.5 rounded-xl border border-border bg-surface p-6">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">details</div>
        <form onSubmit={saveCourse} className="mt-4.5">
          <CourseForm values={values} onChange={setValues} slugEditable={false} />
          {saveError && <p className="mt-4 text-sm text-danger">{saveError}</p>}
          <button
            type="submit"
            disabled={saving}
            className="mt-5 w-fit rounded-lg bg-accent px-6 py-3 text-[14.5px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save details"}
          </button>
        </form>
      </div>

      <CourseAiImportPanel
        slug={slug}
        title={values.title}
        description={values.description}
        onImported={refreshAfterAiImport}
      />

      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">modules</div>
          {course.published_at ? (
            <button
              onClick={unpublish}
              className="rounded-md border border-border-strong px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted"
            >
              unpublish
            </button>
          ) : (
            <button
              onClick={publish}
              className="rounded-md bg-accent px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744]"
            >
              publish
            </button>
          )}
        </div>
        {publishError && <p className="mt-3 text-sm text-danger">{publishError}</p>}

        <div className="mt-4.5 flex flex-col gap-2">
          {modules.length === 0 && <p className="text-sm text-muted">No modules yet.</p>}
          {modules.map((m, i) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border-strong bg-background px-4 py-3">
              <div className="min-w-40 flex-1">
                <div className="text-sm font-medium">{m.title}</div>
                <div className="mt-0.5 font-mono text-[10px] text-faint">
                  {m.lesson_count} lesson{m.lesson_count === 1 ? "" : "s"} · {m.has_quiz ? "has quiz" : "no quiz yet"}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => reorderModule(m.id, "up")}
                  disabled={i === 0}
                  className="rounded-md border border-border-strong px-2 py-1 text-xs text-muted disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => reorderModule(m.id, "down")}
                  disabled={i === modules.length - 1}
                  className="rounded-md border border-border-strong px-2 py-1 text-xs text-muted disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
              <Link
                href={`/admin/courses/${slug}/modules/${m.id}`}
                className="rounded-md border border-border-strong px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted"
              >
                manage
              </Link>
              <button
                onClick={() => removeModule(m.id, m.title)}
                className="rounded-md border border-[#f6d9d6] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-danger"
              >
                delete
              </button>
            </div>
          ))}
        </div>

        {moduleError && <p className="mt-3 text-sm text-danger">{moduleError}</p>}

        <form onSubmit={addModule} className="mt-4 flex gap-2">
          <input
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="New module title"
            className="flex-1 rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-md border border-border-strong px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted"
          >
            + add
          </button>
        </form>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">final exam</div>
        <p className="mt-2 text-[13.5px] text-muted">
          Gates course completion once every module is passed — make this the elaborate one (30-50 questions).
        </p>

        <form onSubmit={saveFinalExam} className="mt-4.5 flex flex-col gap-3.5">
          <input
            value={examTitle}
            onChange={(e) => setExamTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <textarea
            value={examIntro}
            onChange={(e) => setExamIntro(e.target.value)}
            placeholder="Intro / warning shown before the student starts"
            rows={2}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <label className="block">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Pass threshold (%)</div>
            <input
              type="number"
              min={1}
              max={100}
              value={examThreshold}
              onChange={(e) => setExamThreshold(e.target.value)}
              className="mt-2 w-32 rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
            />
          </label>
          {examError && <p className="text-sm text-danger">{examError}</p>}
          <button
            type="submit"
            disabled={examBusy}
            className="w-fit rounded-md bg-accent px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744] disabled:opacity-50"
          >
            {examBusy ? "Saving…" : finalExam ? "Save exam details" : "Create final exam"}
          </button>
        </form>

        {finalExam && (
          <div className="mt-5.5 border-t border-border pt-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">questions</div>
            <div className="mt-3">
              <QuizQuestionBuilder quizId={finalExam.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
