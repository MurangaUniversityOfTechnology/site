"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, communityApi, type CommunityPostDetail } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { signInHref } from "@/lib/nextParam";
import { CommunityPostCard } from "@/components/CommunityPostCard";
import { CommunityAttachments } from "@/components/CommunityAttachments";
import { CommunityAttachmentPicker } from "@/components/CommunityAttachmentPicker";

const MAX_COMMENT_ATTACHMENTS = 2;

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function PostDetailClient({ id }: { id: string }) {
  const { me } = useMe();
  const [post, setPost] = useState<CommunityPostDetail | null | undefined>(undefined);
  const canModerate = !!me && (me.is_admin || me.is_staff);

  function load() {
    communityApi
      .get(id)
      .then(setPost)
      .catch(() => setPost(null));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (post === undefined) return null;

  if (!post) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em]">Post not found</h1>
          <Link href="/community/board" className="mt-3 inline-block text-navy hover:underline">
            Back to the board
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-140 px-5 py-12 sm:px-8 sm:py-14">
      <Link
        href="/community/board"
        className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint hover:text-muted"
      >
        ← questions & polls
      </Link>

      <div className="mt-6">
        <CommunityPostCard
          post={post}
          canModerate={canModerate}
          signedIn={!!me}
          onChange={(updated) => setPost({ ...post, ...updated })}
          linkToDetail={false}
          showExcerpt={false}
        />
        {post.body && (
          <div className="mt-4 whitespace-pre-wrap px-1 text-[15px] leading-[1.6] text-foreground">{post.body}</div>
        )}
      </div>

      <Comments post={post} canModerate={canModerate} signedIn={!!me} onCommented={load} />
    </main>
  );
}

function Comments({
  post,
  canModerate,
  signedIn,
  onCommented,
}: {
  post: CommunityPostDetail;
  canModerate: boolean;
  signedIn: boolean;
  onCommented: () => void;
}) {
  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await communityApi.addComment(post.id, body.trim(), isAnonymous, attachments);
      setBody("");
      setIsAnonymous(false);
      setAttachments([]);
      onCommented();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't post that comment.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleHidden(commentId: string, hidden: boolean) {
    setPending((p) => ({ ...p, [commentId]: true }));
    try {
      if (hidden) await communityApi.unhideComment(commentId);
      else await communityApi.hideComment(commentId);
      onCommented();
    } finally {
      setPending((p) => ({ ...p, [commentId]: false }));
    }
  }

  async function castVote(commentId: string, value: 1 | -1) {
    if (pending[commentId]) return;
    setPending((p) => ({ ...p, [commentId]: true }));
    try {
      await communityApi.voteComment(commentId, value);
      onCommented();
    } finally {
      setPending((p) => ({ ...p, [commentId]: false }));
    }
  }

  return (
    <div className="mt-8">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
        {post.comment_count} comment{post.comment_count === 1 ? "" : "s"}
      </div>

      <div className="mt-3.5 flex flex-col gap-3.5">
        {post.comments.map((c) => (
          <div key={c.id} className={`rounded-lg border border-border bg-surface p-3.5 ${c.is_hidden ? "opacity-60" : ""}`}>
            <div className="flex items-center gap-2 font-mono text-[10.5px] text-faint">
              <span className="text-foreground">{c.author_display}</span>
              <span>{timeAgo(c.created_at)}</span>
              {c.is_anonymous && <span className="rounded border border-border-strong px-1.5 py-0.5">Anonymous</span>}
              {c.is_hidden && <span className="rounded border border-danger/40 px-1.5 py-0.5 text-danger">Hidden</span>}
              {canModerate && (
                <button
                  onClick={() => toggleHidden(c.id, c.is_hidden)}
                  disabled={pending[c.id]}
                  className="ml-auto text-danger hover:underline"
                >
                  {c.is_hidden ? "Unhide" : "Hide"}
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[14.5px] leading-[1.5]">{c.body}</p>
            <CommunityAttachments urls={c.attachments} compact />
            <div className="mt-2 flex items-center gap-1">
              <button
                type="button"
                disabled={!signedIn || pending[c.id]}
                onClick={() => castVote(c.id, 1)}
                aria-label="Upvote comment"
                className={`grid h-5.5 w-5.5 place-items-center rounded border text-[10px] disabled:cursor-default ${
                  c.my_vote === 1 ? "border-accent-dim bg-accent/12 text-accent-dim" : "border-border-strong text-muted"
                }`}
              >
                ▲
              </button>
              <span className="min-w-[1.2em] text-center font-mono text-[11px] text-faint">{c.score}</span>
              <button
                type="button"
                disabled={!signedIn || pending[c.id]}
                onClick={() => castVote(c.id, -1)}
                aria-label="Downvote comment"
                className={`grid h-5.5 w-5.5 place-items-center rounded border text-[10px] disabled:cursor-default ${
                  c.my_vote === -1 ? "border-danger/50 bg-danger/10 text-danger" : "border-border-strong text-muted"
                }`}
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>

      {signedIn ? (
        <form onSubmit={submit} className="mt-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            maxLength={2000}
            className="w-full resize-none rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-[14px] leading-[1.5] outline-none focus:border-accent"
          />
          <CommunityAttachmentPicker attachments={attachments} onChange={setAttachments} max={MAX_COMMENT_ATTACHMENTS} />
          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
              Comment anonymously
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent px-4 py-2 text-[13.5px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Posting…" : "Comment"}
            </button>
          </div>
          {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
        </form>
      ) : (
        <a href={signInHref(`/community/board/${post.id}`)} className="mt-4 inline-block text-[13.5px] text-navy hover:underline">
          Sign in to comment
        </a>
      )}
    </div>
  );
}
