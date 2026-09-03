"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError, courseApi, type CapstoneAssignment } from "@/lib/api";

const STATUS_COPY: Record<string, { label: string; color: string; body: string }> = {
  pending: { label: "Pending review", color: "text-warn", body: "An admin will review it soon." },
  approved: { label: "Approved ✓", color: "text-navy", body: "Your capstone was approved — course complete." },
  rejected: { label: "Not approved yet", color: "text-danger", body: "Take another look and resubmit below." },
};

export default function CapstonePage() {
  const { slug } = useParams<{ slug: string }>();
  const [assignment, setAssignment] = useState<CapstoneAssignment | null | undefined>(undefined);
  const [denied, setDenied] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [whatBuilt, setWhatBuilt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    courseApi
      .capstone(slug)
      .then((result) => {
        setAssignment(result);
        if (result.submission) {
          setGithubUrl(result.submission.github_url);
          setWhatBuilt(result.submission.what_built);
        }
      })
      .catch((err) => {
        setAssignment(null);
        setDenied(
          err instanceof ApiError && err.status === 403
            ? "Pass the final exam before submitting your capstone."
            : "This course has no capstone assignment."
        );
      });
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await courseApi.submitCapstone(slug, { github_url: githubUrl.trim(), what_built: whatBuilt.trim() });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (assignment === undefined) return null;

  if (!assignment) {
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

  const status = assignment.submission ? STATUS_COPY[assignment.submission.review_status] : null;

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-10">
      <Link href={`/courses/${slug}/learn`} className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-foreground">
        ← back to modules
      </Link>
      <h1 className="mt-4 text-[clamp(24px,3.6vw,36px)] tracking-[-0.03em]">{assignment.title}</h1>
      <p className="mt-4 whitespace-pre-wrap text-[15px] leading-[1.6] text-muted">{assignment.instructions}</p>

      {status && (
        <div className="mt-6 rounded-lg border border-border-strong bg-surface px-4.5 py-3.5">
          <div className={`font-mono text-[10.5px] uppercase tracking-[0.1em] ${status.color}`}>{status.label}</div>
          <div className="mt-1 text-[13.5px] text-muted">{status.body}</div>
        </div>
      )}

      {assignment.submission?.review_status !== "approved" && (
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3.5">
          <input
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="GitHub URL"
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <textarea
            value={whatBuilt}
            onChange={(e) => setWhatBuilt(e.target.value)}
            placeholder="What did you build?"
            rows={5}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !githubUrl.trim() || !whatBuilt.trim()}
            className="w-fit rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : assignment.submission ? "Resubmit" : "Submit"}
          </button>
        </form>
      )}
    </main>
  );
}
