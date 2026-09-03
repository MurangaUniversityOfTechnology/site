"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AntiCopyPasteNotice } from "@/components/AntiCopyPasteNotice";
import { useConfirm } from "@/components/ConfirmDialog";
import { ApiError, courseApi, type FinalExamIntro } from "@/lib/api";

export default function FinalExamIntroPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const [intro, setIntro] = useState<FinalExamIntro | null | undefined>(undefined);
  const [denied, setDenied] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [alreadyPassed, setAlreadyPassed] = useState(false);
  const [retaking, setRetaking] = useState(false);

  useEffect(() => {
    let active = true;
    courseApi
      .finalExamIntro(slug)
      .then((result) => {
        if (active) setIntro(result);
      })
      .catch((err) => {
        if (!active) return;
        setIntro(null);
        setDenied(
          err instanceof ApiError && err.status === 403
            ? "Pass every module quiz before starting the final exam."
            : "This course has no final exam."
        );
      });
    courseApi
      .progress(slug)
      .then((result) => {
        if (active) setAlreadyPassed(result.final_exam_passed);
      })
      .catch(() => {
        // already surfaced via the intro fetch above if this is an access problem
      });
    return () => {
      active = false;
    };
  }, [slug]);

  async function retake() {
    const ok = await confirm({
      title: "Retake the final exam?",
      message: "You've already passed this exam, and that stays on record either way — this just lets you attempt it again.",
      confirmLabel: "Retake exam",
      danger: false,
    });
    if (ok) setRetaking(true);
  }

  if (intro === undefined) return null;

  if (!intro) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em]">Not ready yet</h1>
          <p className="mt-2 text-sm text-muted">{denied}</p>
          <Link href={`/courses/${slug}/learn`} className="mt-3 inline-block text-navy hover:underline">
            Back to course
          </Link>
        </div>
      </main>
    );
  }

  if (alreadyPassed && !retaking) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 sm:px-10">
        <Link href={`/courses/${slug}/learn`} className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-foreground">
          ← back to modules
        </Link>
        <h1 className="mt-4 text-[clamp(24px,3.6vw,36px)] tracking-[-0.03em]">Final exam</h1>

        <div className="mt-6 rounded-lg border border-border-strong bg-navy/[0.04] px-5 py-4">
          <div className="font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-navy">Passed ✓</div>
          <div className="mt-1 text-sm text-muted">You&apos;ve already passed this exam — your progress is saved.</div>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={`/courses/${slug}/learn`}
            className="rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
          >
            Continue course
          </Link>
          <button
            onClick={retake}
            className="rounded-lg border border-border-strong px-6.5 py-3.5 text-[15px] font-semibold text-muted hover:border-accent-dim hover:text-navy"
          >
            Retake exam
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-10">
      <Link href={`/courses/${slug}/learn`} className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-foreground">
        ← back to modules
      </Link>
      <h1 className="mt-4 text-[clamp(24px,3.6vw,36px)] tracking-[-0.03em]">Final exam</h1>

      {intro.intro_text && <p className="mt-4 text-[15px] leading-[1.6] text-muted">{intro.intro_text}</p>}

      <div className="mt-6 flex max-w-sm flex-wrap gap-px overflow-hidden rounded-[10px] border border-border bg-border">
        <div className="min-w-32 flex-1 bg-surface px-5.5 py-4">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">questions</div>
          <div className="mt-1.5 text-[17px] font-semibold">{intro.question_count}</div>
        </div>
        <div className="min-w-32 flex-1 bg-surface px-5.5 py-4">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">pass mark</div>
          <div className="mt-1.5 text-[17px] font-semibold">{intro.pass_threshold_pct}%</div>
        </div>
      </div>

      <div className="mt-7">
        <AntiCopyPasteNotice onAcknowledged={setReady} />
      </div>

      <button
        onClick={() => router.push(`/courses/${slug}/learn/final-exam/take`)}
        disabled={!ready}
        className="mt-7 rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
      >
        {retaking ? "Retake final exam" : "Begin final exam"}
      </button>
    </main>
  );
}
