"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, contentApi } from "@/lib/api";
import { useMe } from "@/lib/useMe";

const TAG_OPTIONS = ["Backend", "Frontend", "Rust", "Python", "DevOps", "Career"];

export default function PublishPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.push("/sign-in");
  }, [loading, me, router]);

  if (loading || !me) return null;

  function toggleTag(tag: string) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await contentApi.submit({ title, body, tags });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14 text-center">
        <div className="w-full max-w-105 animate-[rise_0.4s_ease_both]">
          <div className="mx-auto grid h-15 w-15 place-items-center rounded-full border border-[#3a3226] bg-warn/10 font-mono text-xl text-warn">
            ◷
          </div>
          <div className="mt-5.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-warn">pending review</div>
          <h1 className="mt-3.5 text-[clamp(24px,3.4vw,32px)] leading-[1.15] tracking-[-0.03em]">
            Submitted for review
          </h1>
          <p className="mt-4 text-[15.5px] leading-[1.6] text-[#9aa6a0]">
            An admin reads every article before it goes public — mostly to catch broken code samples. You&apos;ll be
            notified either way.
          </p>
          <Link
            href="/community"
            className="mt-6.5 inline-block rounded-lg border border-border-strong px-6 py-3.5 text-[15px] hover:border-accent-dim"
          >
            Back to community
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14">
      <div className="w-full max-w-140">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent">write something</div>
        <h1 className="mt-4 text-[clamp(26px,3.8vw,36px)] leading-[1.1] tracking-[-0.035em]">Publish to the club</h1>
        <p className="mt-3 text-[15.5px] leading-[1.55] text-[#9aa6a0]">
          Write it up while it&apos;s fresh. The best articles here are &ldquo;what broke and how I fixed it&rdquo;.
        </p>

        <label className="mb-2 mt-6.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Understanding Rust ownership without the fear"
          className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-3 text-base outline-none focus:border-accent"
        />

        <label className="mb-2 mt-5 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          body · markdown
        </label>
        <textarea
          rows={7}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="The borrow checker isn't fighting you. It's telling you something about lifetimes you haven't thought about yet..."
          className="w-full resize-y rounded-lg border border-border-strong bg-surface px-3.5 py-3 font-mono text-[13.5px] leading-[1.6] outline-none focus:border-accent"
        />

        <label className="mb-2.5 mt-5 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">tags</label>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map((tag) => {
            const on = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-3.5 py-2 text-sm ${
                  on ? "border-accent-dim bg-accent/10 text-accent" : "border-border-strong text-muted"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <div className="mt-6.5 flex flex-wrap gap-3">
          <button
            onClick={submit}
            disabled={submitting || !title.trim() || !body.trim()}
            className="rounded-lg bg-accent px-6 py-3.5 text-[15px] font-semibold text-[#04140b] hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit for review"}
          </button>
        </div>
      </div>
    </main>
  );
}
