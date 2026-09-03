"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { ApiError, courseApi, type LessonDetail, type ModulePublic } from "@/lib/api";

function youtubeEmbedUrl(url: string): string {
  const match = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
}

export default function LessonPage() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>();
  const [lesson, setLesson] = useState<LessonDetail | null | undefined>(undefined);
  const [modules, setModules] = useState<ModulePublic[] | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let active = true;
    courseApi
      .lesson(slug, lessonId)
      .then((result) => {
        if (!active) return;
        setLesson(result);
        courseApi.completeLesson(slug, lessonId).catch(() => {
          // best-effort — the read already succeeded, a completion hiccup isn't worth blocking on
        });
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 403) setDenied(true);
        setLesson(null);
      });
    courseApi.modules(slug).then((result) => {
      if (active) setModules(result);
    });
    return () => {
      active = false;
    };
  }, [slug, lessonId]);

  if (lesson === undefined) return null;

  if (!lesson) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em]">{denied ? "This lesson is locked" : "Lesson not found"}</h1>
          <Link href={`/courses/${slug}/learn`} className="mt-3 inline-block text-navy hover:underline">
            Back to course
          </Link>
        </div>
      </main>
    );
  }

  // Prev/next stay within the current module — the next module's lessons
  // are locked until this module's quiz is passed, so jumping straight
  // into them from "next" would just dead-end on a locked page. Once
  // you're on the last lesson of a module, "next" points at that
  // module's quiz instead of into the (locked) next module.
  const currentModule = modules?.find((m) => m.lessons.some((l) => l.id === lessonId));
  const lessonsInModule = currentModule?.lessons ?? [];
  const idx = lessonsInModule.findIndex((l) => l.id === lessonId);
  const prev = idx > 0 ? { href: `/courses/${slug}/learn/lessons/${lessonsInModule[idx - 1].id}`, label: lessonsInModule[idx - 1].title } : null;
  const next =
    idx >= 0 && idx < lessonsInModule.length - 1
      ? { href: `/courses/${slug}/learn/lessons/${lessonsInModule[idx + 1].id}`, label: lessonsInModule[idx + 1].title }
      : currentModule
        ? { href: `/courses/${slug}/learn/modules/${currentModule.id}/quiz`, label: "Take module quiz" }
        : null;

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-10">
      <Link href={`/courses/${slug}/learn`} className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-foreground">
        ← back to modules
      </Link>
      <h1 className="mt-4 text-[clamp(24px,3.6vw,36px)] tracking-[-0.03em]">{lesson.title}</h1>

      {lesson.video_url && (
        <div className="mt-6 aspect-video overflow-hidden rounded-lg border border-border">
          <iframe src={youtubeEmbedUrl(lesson.video_url)} className="h-full w-full" allowFullScreen />
        </div>
      )}

      <div className="mt-6">
        <Markdown>{lesson.body}</Markdown>
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-border pt-5">
        {prev ? (
          <Link href={prev.href} className="font-mono text-[12px] text-muted hover:text-navy">
            ← {prev.label}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={next.href} className="font-mono text-[12px] text-muted hover:text-navy">
            {next.label} →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}
