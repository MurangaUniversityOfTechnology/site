"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError, adminApi } from "@/lib/api";

const INPUT = "w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent";
const LABEL = "font-mono text-[10px] uppercase tracking-[0.12em] text-faint";
const MIN_TERMS = 24;

// A starter set so a new deck is playable straight away; edit freely.
const STARTER_TERMS = `git commit
merge conflict
pull request
API
localhost
404
stack overflow
segfault
infinite loop
null pointer
recursion
Docker
Linux
sudo
Python
JavaScript
it works on my machine
cache
bug
deploy
open source
terminal
compiler
cloud
Arduino
machine learning
dark mode
README
semicolon
hackathon`;

export default function EditBingoDeckPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const [title, setTitle] = useState(isNew ? "Tech Bingo" : "");
  const [terms, setTerms] = useState<string | null>(isNew ? STARTER_TERMS : null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isNew) return;
    adminApi.getBingoDeck(id).then((deck) => {
      setTitle(deck.title);
      setTerms(deck.terms.join("\n"));
    });
  }, [id, isNew]);

  const list = (terms ?? "").split("\n").map((t) => t.trim()).filter(Boolean);
  const distinct = new Set(list.map((t) => t.toLowerCase())).size;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const deck = await adminApi.createBingoDeck({ title: title.trim(), terms: list });
        router.replace(`/admin/games/decks/${deck.id}`);
      } else {
        await adminApi.updateBingoDeck(id, { title: title.trim(), terms: list });
        setSaved(true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the deck.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-180">
      <Link href="/admin/games" className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-muted">
        ← games
      </Link>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">{isNew ? "New bingo deck" : title || "Bingo deck"}</h1>
      <p className="mt-2.5 max-w-140 text-[14px] leading-[1.55] text-muted">
        One term per line, at least {MIN_TERMS}. Each player gets a random 24 of these on their card. More terms means
        cards differ more, and the game runs longer before someone wins.
      </p>

      {terms === null ? (
        <p className="mt-8 text-sm text-faint">Loading…</p>
      ) : (
        <form onSubmit={save} className="mt-7 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5.5">
          <label className="block">
            <div className={LABEL}>Title</div>
            <input value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} required maxLength={120} className={`mt-1.5 ${INPUT}`} />
          </label>
          <label className="block">
            <div className="flex items-baseline justify-between">
              <span className={LABEL}>Terms</span>
              <span className={`font-mono text-[11px] ${distinct < MIN_TERMS ? "text-danger" : "text-faint"}`}>
                {distinct} / {MIN_TERMS}+ terms
              </span>
            </div>
            <textarea
              value={terms}
              onChange={(e) => { setTerms(e.target.value); setSaved(false); }}
              rows={16}
              className={`mt-1.5 ${INPUT} resize-y font-mono text-[13px] leading-[1.7]`}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving || distinct < MIN_TERMS} className="rounded-md bg-accent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-navy hover:opacity-90 disabled:opacity-50">
              {saving ? "saving…" : isNew ? "create deck" : "save changes"}
            </button>
            {saved && <span className="text-[13px] text-accent-dim">Saved ✓</span>}
            {error && <span className="text-[13px] text-danger">{error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
