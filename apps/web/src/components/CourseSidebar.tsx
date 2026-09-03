"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/lib/useMe";
import { courseApi, type ModulePublic } from "@/lib/api";

export function CourseSidebar({ slug, onNavigate }: { slug: string; onNavigate?: () => void }) {
  const { me, loading: meLoading } = useMe();
  const pathname = usePathname();
  const [modules, setModules] = useState<ModulePublic[] | null>(null);
  const [finalExamLocked, setFinalExamLocked] = useState(true);
  const [finalExamPassed, setFinalExamPassed] = useState(false);
  const [capstoneStatus, setCapstoneStatus] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (meLoading || !me) return;
    let active = true;
    courseApi
      .modules(slug)
      .then((result) => {
        if (active) setModules(result);
      })
      .catch(() => {
        if (active) setModules(null);
      });
    courseApi
      .finalExamIntro(slug)
      .then(() => {
        if (active) setFinalExamLocked(false);
      })
      .catch(() => {
        // module quizzes not all passed, or no final exam — stays locked
      });
    courseApi
      .progress(slug)
      .then((result) => {
        if (!active) return;
        setFinalExamPassed(result.final_exam_passed);
        setCapstoneStatus(result.capstone_status);
      })
      .catch(() => {
        // no access — the page's own content already surfaces this
      });
    return () => {
      active = false;
    };
  }, [slug, me, meLoading]);

  if (!modules) return null;

  const currentModuleId = modules.find((m) => !m.locked && !m.quiz_passed)?.id;
  const isActive = (path: string) => pathname === path;

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      <Link
        href={`/courses/${slug}`}
        className="mb-2 px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint hover:text-foreground"
        onClick={onNavigate}
      >
        ← back to course
      </Link>

      {modules.map((m, i) => (
        <div key={m.id} className="mb-1">
          <div
            className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium ${
              m.id === currentModuleId ? "bg-accent/[0.08] text-navy" : m.locked ? "text-faint" : "text-foreground"
            }`}
          >
            <span className="font-mono text-[10.5px] text-faint">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex-1 truncate">{m.title}</span>
            {m.quiz_passed && <span className="text-navy">✓</span>}
            {m.locked && <span>🔒</span>}
          </div>
          {!m.locked && (
            <div className="ml-7 flex flex-col gap-0.5 border-l border-border pl-2.5">
              {m.lessons.map((l) => {
                const href = `/courses/${slug}/learn/lessons/${l.id}`;
                return (
                  <Link
                    key={l.id}
                    href={href}
                    onClick={onNavigate}
                    className={`truncate rounded px-2 py-1 text-[12.5px] ${
                      isActive(href) ? "bg-accent/[0.08] text-navy" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {l.completed ? "✓ " : "· "}
                    {l.title}
                  </Link>
                );
              })}
              {(() => {
                const href = `/courses/${slug}/learn/modules/${m.id}/quiz`;
                return (
                  <Link
                    key="quiz"
                    href={href}
                    onClick={onNavigate}
                    className={`truncate rounded px-2 py-1 font-mono text-[11px] uppercase tracking-[0.06em] ${
                      isActive(href) ? "bg-accent/[0.08] text-navy" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {m.quiz_passed ? "retake quiz" : "take quiz"}
                  </Link>
                );
              })()}
            </div>
          )}
        </div>
      ))}

      <div
        className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium ${
          finalExamLocked ? "text-faint" : isActive(`/courses/${slug}/learn/final-exam`) ? "bg-accent/[0.08] text-navy" : "text-foreground"
        }`}
      >
        <span className="font-mono text-[10.5px] text-faint">{String(modules.length + 1).padStart(2, "0")}</span>
        {finalExamLocked ? (
          <span className="flex-1">Final exam 🔒</span>
        ) : (
          <Link href={`/courses/${slug}/learn/final-exam`} onClick={onNavigate} className="flex-1">
            Final exam
          </Link>
        )}
        {finalExamPassed && <span className="text-navy">✓</span>}
      </div>

      {capstoneStatus !== undefined && capstoneStatus !== null && (
        <div
          className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium ${
            !finalExamPassed ? "text-faint" : isActive(`/courses/${slug}/learn/capstone`) ? "bg-accent/[0.08] text-navy" : "text-foreground"
          }`}
        >
          <span className="font-mono text-[10.5px] text-faint">{String(modules.length + 2).padStart(2, "0")}</span>
          {!finalExamPassed ? (
            <span className="flex-1">Capstone 🔒</span>
          ) : (
            <Link href={`/courses/${slug}/learn/capstone`} onClick={onNavigate} className="flex-1">
              Capstone
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
