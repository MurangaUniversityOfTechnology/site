"use client";

import { useState } from "react";
import { ApiError, communityApi, type CommunityPostKind, type CommunityPostSummary } from "@/lib/api";
import { CommunityAttachmentPicker } from "@/components/CommunityAttachmentPicker";

const MAX_POST_ATTACHMENTS = 4;

export function CommunityComposer({ onCreated }: { onCreated: (post: CommunityPostSummary) => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CommunityPostKind>("question");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [options, setOptions] = useState(["", ""]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setKind("question");
    setTitle("");
    setBody("");
    setIsAnonymous(true);
    setOptions(["", ""]);
    setAttachments([]);
    setError(null);
  }

  function updateOption(i: number, value: string) {
    setOptions((opts) => opts.map((o, idx) => (idx === i ? value : o)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give it a title.");
      return;
    }
    const cleanedOptions = kind === "poll" ? options.map((o) => o.trim()).filter(Boolean) : [];
    if (kind === "poll" && cleanedOptions.length < 2) {
      setError("A poll needs at least 2 options.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const post = await communityApi.create({
        kind,
        title: title.trim(),
        body: body.trim() || null,
        is_anonymous: isAnonymous,
        options: cleanedOptions,
        attachments,
      });
      onCreated(post);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't post that.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => {
            setKind("question");
            setOpen(true);
          }}
          className="rounded-lg border border-border-strong px-4 py-2.5 text-sm hover:border-accent-dim"
        >
          Ask a question
        </button>
        <button
          type="button"
          onClick={() => {
            setKind("poll");
            setOpen(true);
          }}
          className="rounded-lg border border-border-strong px-4 py-2.5 text-sm hover:border-accent-dim"
        >
          Start a poll
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
          New {kind === "poll" ? "poll" : "question"}
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-muted hover:text-foreground">
          Cancel
        </button>
      </div>

      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={kind === "poll" ? "What are we deciding?" : "What do you want to ask?"}
        maxLength={200}
        className="mt-3 w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-[15px] outline-none focus:border-accent"
      />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add detail — paste a link and we'll show a preview (optional)"
        rows={3}
        maxLength={4000}
        className="mt-2.5 w-full resize-none rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-[14px] leading-[1.5] outline-none focus:border-accent"
      />

      {kind === "poll" && (
        <div className="mt-2.5 flex flex-col gap-2">
          {options.map((o, i) => (
            <input
              key={i}
              value={o}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              maxLength={100}
              className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2 text-[14px] outline-none focus:border-accent"
            />
          ))}
          <div className="flex gap-3">
            {options.length < 6 && (
              <button
                type="button"
                onClick={() => setOptions((opts) => [...opts, ""])}
                className="text-[13px] text-navy hover:underline"
              >
                + Add option
              </button>
            )}
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => setOptions((opts) => opts.slice(0, -1))}
                className="text-[13px] text-muted hover:underline"
              >
                Remove last
              </button>
            )}
          </div>
        </div>
      )}

      <CommunityAttachmentPicker attachments={attachments} onChange={setAttachments} max={MAX_POST_ATTACHMENTS} />

      <label className="mt-3 flex items-center gap-2 text-[13.5px] text-muted">
        <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
        Post anonymously
      </label>
      {isAnonymous && (
        <div className="mt-1.5 w-fit rounded border border-border-strong px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
          Will show as Anonymous
        </div>
      )}

      {error && <p className="mt-2.5 text-[13px] text-danger">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Posting…" : "Post"}
      </button>
    </form>
  );
}
