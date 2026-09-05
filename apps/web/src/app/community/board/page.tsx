"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { communityApi, type CommunityPostKind, type CommunityPostSummary } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { signInHref } from "@/lib/nextParam";
import { CommunityComposer } from "@/components/CommunityComposer";
import { CommunityPostCard } from "@/components/CommunityPostCard";

export default function CommunityBoardPage() {
  const { me } = useMe();
  const [posts, setPosts] = useState<CommunityPostSummary[] | null>(null);
  const [filter, setFilter] = useState<CommunityPostKind | "all">("all");
  const canModerate = !!me && (me.is_admin || me.is_staff);

  useEffect(() => {
    let active = true;
    communityApi.list(filter === "all" ? undefined : filter).then((result) => {
      if (active) setPosts(result);
    });
    return () => {
      active = false;
    };
  }, [filter]);

  function updatePost(updated: CommunityPostSummary) {
    setPosts((prev) => prev?.map((p) => (p.id === updated.id ? updated : p)) ?? prev);
  }

  return (
    <main className="mx-auto max-w-160 px-5 py-12 sm:px-8 sm:py-14">
      <Link href="/community" className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint hover:text-muted">
        ← community
      </Link>
      <h1 className="mt-3.5 text-[clamp(28px,4.5vw,44px)] leading-none tracking-[-0.035em]">Questions & polls</h1>
      <p className="mt-3.5 max-w-140 text-[15.5px] leading-[1.55] text-muted">
        Anyone can ask, poll, or weigh in. Posts marked <span className="text-foreground">Anonymous</span> hide who wrote
        them from other members.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em]">
          {(["all", "question", "poll"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-md px-3 py-1.5 ${filter === k ? "bg-navy/8 text-navy" : "text-muted hover:text-foreground"}`}
            >
              {k === "all" ? "All" : k === "question" ? "Questions" : "Polls"}
            </button>
          ))}
        </div>
        {me ? (
          <CommunityComposer onCreated={(post) => setPosts((prev) => (prev ? [post, ...prev] : [post]))} />
        ) : (
          <a href={signInHref("/community/board")} className="text-[13.5px] text-navy hover:underline">
            Sign in to post
          </a>
        )}
      </div>

      {posts?.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          Nothing here yet — be the first to ask something.
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {posts?.map((post) => (
          <CommunityPostCard key={post.id} post={post} canModerate={canModerate} signedIn={!!me} onChange={updatePost} />
        ))}
      </div>
    </main>
  );
}
