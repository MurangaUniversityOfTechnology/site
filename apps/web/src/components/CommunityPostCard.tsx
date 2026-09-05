"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, communityApi, type CommunityPostSummary } from "@/lib/api";
import { CommunityLinkPreview } from "@/components/CommunityLinkPreview";
import { CommunityAttachments } from "@/components/CommunityAttachments";
import { signInHref } from "@/lib/nextParam";

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function CommunityPostCard({
  post,
  canModerate,
  signedIn,
  onChange,
  linkToDetail = true,
  showExcerpt = true,
}: {
  post: CommunityPostSummary;
  canModerate: boolean;
  signedIn: boolean;
  onChange: (updated: CommunityPostSummary) => void;
  linkToDetail?: boolean;
  showExcerpt?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function castVote(value: 1 | -1) {
    if (!signedIn || busy) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await communityApi.vote(post.id, value));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't vote.");
    } finally {
      setBusy(false);
    }
  }

  async function castPollVote(optionId: string) {
    if (!signedIn || busy) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await communityApi.pollVote(post.id, optionId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't vote.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleHidden() {
    setBusy(true);
    try {
      if (post.is_hidden) await communityApi.unhidePost(post.id);
      else await communityApi.hidePost(post.id);
      onChange({ ...post, is_hidden: !post.is_hidden });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update this post.");
    } finally {
      setBusy(false);
    }
  }

  const totalPollVotes = post.options?.reduce((sum, o) => sum + o.vote_count, 0) ?? 0;
  const title = linkToDetail ? (
    <Link href={`/community/board/${post.id}`} className="hover:underline">
      {post.title}
    </Link>
  ) : (
    post.title
  );

  return (
    <div className={`rounded-xl border border-border bg-surface p-5 ${post.is_hidden ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em]">
        <span className={post.kind === "poll" ? "text-navy" : "text-accent-dim"}>{post.kind === "poll" ? "Poll" : "Question"}</span>
        {post.is_anonymous && <span className="rounded border border-border-strong px-1.5 py-0.5 text-faint">Anonymous</span>}
        {post.is_hidden && <span className="rounded border border-danger/40 px-1.5 py-0.5 text-danger">Hidden</span>}
      </div>

      <div className="mt-2 text-[17px] leading-[1.35]">{title}</div>
      {showExcerpt && post.excerpt && <p className="mt-1.5 text-[14px] leading-[1.5] text-muted">{post.excerpt}</p>}
      {post.link && <CommunityLinkPreview link={post.link} compact />}
      <CommunityAttachments urls={post.attachments} compact={linkToDetail} />

      {post.kind === "poll" && post.options && (
        <div className="mt-3.5 flex flex-col gap-1.5">
          {post.options.map((o) => {
            const pct = totalPollVotes ? Math.round((o.vote_count / totalPollVotes) * 100) : 0;
            const mine = post.my_option_id === o.id;
            return (
              <button
                key={o.id}
                type="button"
                disabled={!signedIn || busy}
                onClick={() => castPollVote(o.id)}
                className={`relative overflow-hidden rounded-md border px-3 py-2 text-left text-[13.5px] disabled:cursor-default ${
                  mine ? "border-accent-dim" : "border-border-strong"
                }`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-accent/12"
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
                <div className="relative flex items-center justify-between gap-2">
                  <span>{o.label}</span>
                  <span className="font-mono text-[11px] text-faint">
                    {pct}% · {o.vote_count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-4 font-mono text-[11px] text-faint">
        {post.kind === "question" && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!signedIn || busy}
              onClick={() => castVote(1)}
              aria-label="Upvote"
              className={`grid h-6.5 w-6.5 place-items-center rounded border disabled:cursor-default ${
                post.my_vote === 1 ? "border-accent-dim bg-accent/12 text-accent-dim" : "border-border-strong text-muted"
              }`}
            >
              ▲
            </button>
            <span className="min-w-[1.5em] text-center text-[12px] text-foreground">{post.score ?? 0}</span>
            <button
              type="button"
              disabled={!signedIn || busy}
              onClick={() => castVote(-1)}
              aria-label="Downvote"
              className={`grid h-6.5 w-6.5 place-items-center rounded border disabled:cursor-default ${
                post.my_vote === -1 ? "border-danger/50 bg-danger/10 text-danger" : "border-border-strong text-muted"
              }`}
            >
              ▼
            </button>
          </div>
        )}
        <Link href={`/community/board/${post.id}`} className="hover:text-muted">
          {post.comment_count} comment{post.comment_count === 1 ? "" : "s"}
        </Link>
        <span>{post.author_display}</span>
        <span>{timeAgo(post.created_at)}</span>
        {!signedIn && (
          <a href={signInHref("/community/board")} className="text-navy hover:underline">
            Sign in to join in
          </a>
        )}
        {canModerate && (
          <button type="button" onClick={toggleHidden} disabled={busy} className="ml-auto text-danger hover:underline">
            {post.is_hidden ? "Unhide" : "Hide"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}
