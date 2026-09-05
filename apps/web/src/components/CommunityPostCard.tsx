"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, communityApi, type CommunityPostSummary } from "@/lib/api";
import { CommunityLinkPreview } from "@/components/CommunityLinkPreview";
import { CommunityAttachments } from "@/components/CommunityAttachments";
import { CommunityAttachmentPicker } from "@/components/CommunityAttachmentPicker";
import { CommunityShareButton } from "@/components/CommunityShareButton";
import { useConfirm } from "@/components/ConfirmDialog";
import { signInHref } from "@/lib/nextParam";

const MAX_POST_ATTACHMENTS = 4;

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
  onDeleted,
  linkToDetail = true,
  showExcerpt = true,
}: {
  // The detail page passes a CommunityPostDetail (which has a real `body`)
  // through this same prop — Edit is only ever offered there (see
  // linkToDetail below), so the full text is available when it's needed.
  post: CommunityPostSummary & { body?: string | null };
  canModerate: boolean;
  signedIn: boolean;
  onChange: (updated: CommunityPostSummary) => void;
  onDeleted?: () => void;
  linkToDetail?: boolean;
  showExcerpt?: boolean;
}) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState("");
  const [editAnonymous, setEditAnonymous] = useState(post.is_anonymous);
  const [editAttachments, setEditAttachments] = useState(post.attachments);

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

  function startEdit() {
    setEditTitle(post.title);
    setEditBody(post.body ?? "");
    setEditAnonymous(post.is_anonymous);
    setEditAttachments(post.attachments);
    setError(null);
    setEditing(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTitle.trim()) {
      setError("Give it a title.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await communityApi.update(post.id, {
        title: editTitle.trim(),
        body: editBody.trim() || null,
        is_anonymous: editAnonymous,
        attachments: editAttachments,
      });
      onChange(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that edit.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePost() {
    const ok = await confirm({
      title: "Delete this post?",
      message: "This removes it and every comment on it. This can't be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await communityApi.remove(post.id);
      onDeleted?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this post.");
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

  if (editing) {
    return (
      <form onSubmit={saveEdit} className="rounded-xl border border-accent-dim bg-surface p-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Editing</div>
        <input
          autoFocus
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          maxLength={200}
          className="mt-3 w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-[15px] outline-none focus:border-accent"
        />
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          placeholder="Add detail — paste a link and we'll show a preview (optional)"
          rows={3}
          maxLength={4000}
          className="mt-2.5 w-full resize-none rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-[14px] leading-[1.5] outline-none focus:border-accent"
        />
        <CommunityAttachmentPicker attachments={editAttachments} onChange={setEditAttachments} max={MAX_POST_ATTACHMENTS} />
        <label className="mt-3 flex items-center gap-2 text-[13.5px] text-muted">
          <input type="checkbox" checked={editAnonymous} onChange={(e) => setEditAnonymous(e.target.checked)} />
          Post anonymously
        </label>
        {error && <p className="mt-2.5 text-[13px] text-danger">{error}</p>}
        <div className="mt-4 flex gap-2.5">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-border-strong px-5 py-2.5 text-[14px] text-muted hover:border-accent-dim"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-surface p-5 ${post.is_hidden ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em]">
        <span className={post.kind === "poll" ? "text-navy" : "text-accent-dim"}>{post.kind === "poll" ? "Poll" : "Question"}</span>
        {post.is_anonymous && <span className="rounded border border-border-strong px-1.5 py-0.5 text-faint">Anonymous</span>}
        {post.is_hidden && <span className="rounded border border-danger/40 px-1.5 py-0.5 text-danger">Hidden</span>}
        {post.edited_at && <span className="text-faint">edited</span>}
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
        <CommunityShareButton postId={post.id} title={post.title} />
        {!signedIn && (
          <a href={signInHref("/community/board")} className="text-navy hover:underline">
            Sign in to join in
          </a>
        )}
        {post.is_mine && !linkToDetail && (
          <button type="button" onClick={startEdit} disabled={busy} className="hover:text-muted">
            Edit
          </button>
        )}
        {post.is_mine && (
          <button type="button" onClick={deletePost} disabled={busy} className="text-danger hover:underline">
            Delete
          </button>
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
