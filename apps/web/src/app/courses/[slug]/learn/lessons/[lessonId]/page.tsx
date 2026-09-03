"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

  const allLessons = modules?.flatMap((m) => m.lessons) ?? [];
  const idx = allLessons.findIndex((l) => l.id === lessonId);
  const prev = idx > 0 ? allLessons[idx - 1] : null;
  const next = idx >= 0 && idx < allLessons.length - 1 ? allLessons[idx + 1] : null;

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

      <p className="mt-6 whitespace-pre-wrap text-[15px] leading-[1.7] text-foreground">{lesson.body}</p>

      <div className="mt-10 flex items-center justify-between border-t border-border pt-5">
        {prev ? (
          <Link href={`/courses/${slug}/learn/lessons/${prev.id}`} className="font-mono text-[12px] text-muted hover:text-navy">
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/courses/${slug}/learn/lessons/${next.id}`} className="font-mono text-[12px] text-muted hover:text-navy">
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}
