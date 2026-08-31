"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError, challengeApi, type Submission } from "@/lib/api";
import { challenges } from "@/lib/data";
import { useMe } from "@/lib/useMe";

export default function SubmitBuildPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const { me, loading } = useMe();

  const challenge = challenges.find((c) => c.slug === slug);

  const [existing, setExisting] = useState<Submission | null | undefined>(undefined);
  const [github, setGithub] = useState("");
  const [demo, setDemo] = useState("");
  const [learned, setLearned] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<Submission | null>(null);

  useEffect(() => {
    if (!loading && !me) router.push("/sign-in");
  }, [loading, me, router]);

  useEffect(() => {
    if (!me) return;
    let active = true;
    challengeApi.mySubmission(slug).then((result) => {
      if (active) setExisting(result);
    });
    return () => {
      active = false;
    };
  }, [me, slug]);

  if (loading || !me || existing === undefined || !challenge) return null;

  const submission = justSubmitted ?? existing;

  if (submission) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14 text-center">
        <div className="w-full max-w-105 animate-[rise_0.45s_ease_both]">
          <div className="mx-auto grid h-16 w-16 animate-[glow_2.4s_ease-in-out_infinite] place-items-center rounded-full border border-accent-dim bg-accent/10 font-mono text-2xl text-navy">
            ✓
          </div>
          <div className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.18em] text-navy">
            challenge complete
          </div>
          <h1 className="mt-3.5 text-[clamp(26px,3.8vw,34px)] leading-[1.15] tracking-[-0.03em]">
            You just shipped
            <br />
            another build.
          </h1>
          <div className="mt-7 flex justify-center gap-px overflow-hidden rounded-[10px] border border-border bg-border">
            <div className="bg-surface px-5 py-3.5">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">credential</div>
              <div className="mt-1.5 font-mono text-[13px] text-navy">#{challenge.num.padStart(2, "0")}</div>
            </div>
            <div className="bg-surface px-5 py-3.5">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">builds shipped</div>
              <div className="mt-1.5 font-mono text-[13px]">{String(submission.total_shipped).padStart(2, "0")}</div>
            </div>
          </div>
          <p className="mt-5.5 text-[15px] leading-[1.55] text-muted">
            It&apos;s on your profile now. Reviews from other members land soon.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-lg bg-accent px-6 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await challengeApi.submit(slug, {
        github_url: github,
        demo_url: demo.trim() || null,
        learned: learned.trim() || null,
      });
      setJustSubmitted(result);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't submit — try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14">
      <div className="w-full max-w-120">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-navy">submit your build</div>
        <h1 className="mt-4 text-[clamp(26px,3.8vw,34px)] tracking-[-0.035em]">{challenge.title}</h1>

        <label className="mb-2 mt-6.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          github repository
        </label>
        <input
          value={github}
          onChange={(e) => setGithub(e.target.value)}
          placeholder="github.com/you/project"
          className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-3 font-mono text-[13.5px] outline-none focus:border-accent"
        />

        <label className="mb-2 mt-5 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          live demo (optional)
        </label>
        <input
          value={demo}
          onChange={(e) => setDemo(e.target.value)}
          placeholder="your-project.dev"
          className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-3 font-mono text-[13.5px] outline-none focus:border-accent"
        />

        <label className="mb-2 mt-5 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          what did you learn?
        </label>
        <textarea
          rows={3}
          value={learned}
          onChange={(e) => setLearned(e.target.value)}
          placeholder="Base62 encoding is easier than I expected. Redis TTLs are not..."
          className="w-full resize-y rounded-lg border border-border-strong bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-accent"
        />

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <button
          onClick={submit}
          disabled={submitting || !github.trim()}
          className="mt-5.5 w-full rounded-lg bg-accent py-4 text-[15.5px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Build"}
        </button>
      </div>
    </main>
  );
}
