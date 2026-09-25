"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, adminApi, type BingoDeckRow, type GameQuizRow, type LiveGameRow } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";

const BTN = "rounded-md border border-border-strong px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted hover:text-foreground";
const BTN_PRIMARY = "rounded-md bg-accent px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-navy hover:opacity-90 disabled:opacity-50";
const BTN_DANGER = "rounded-md border border-[#f6d9d6] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-danger disabled:opacity-50";

export default function AdminGamesPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [quizzes, setQuizzes] = useState<GameQuizRow[] | null>(null);
  const [decks, setDecks] = useState<BingoDeckRow[] | null>(null);
  const [live, setLive] = useState<LiveGameRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi.listGameQuizzes().then(setQuizzes);
    adminApi.listBingoDecks().then(setDecks);
    adminApi.listLiveGames().then(setLive);
  }, []);
  useEffect(load, [load]);

  async function host(id: string, payload: { quiz_id?: string; deck_id?: string }) {
    setBusy(id);
    setError(null);
    try {
      const game = await adminApi.hostGame(payload);
      router.push(`/games/host/${game.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the game.");
      setBusy(null);
    }
  }

  async function remove(kind: "quiz" | "deck", id: string, title: string) {
    const ok = await confirm({ title: `Delete ${kind === "quiz" ? "quiz" : "bingo deck"}?`, message: `"${title}" will be permanently deleted. Games already played keep their results.` });
    if (!ok) return;
    setBusy(id);
    try {
      await (kind === "quiz" ? adminApi.deleteGameQuiz(id) : adminApi.deleteBingoDeck(id));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-220">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">programs</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Games</h1>
      <p className="mt-2.5 max-w-140 text-[14px] leading-[1.55] text-muted">
        Live quizzes and tech bingo for sessions. Press <strong className="font-medium text-foreground">host</strong> to open
        the projector screen with a join PIN. Players join at <span className="font-mono text-[13px]">/games</span> on
        their phones and don&apos;t need an account.
      </p>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {live.length > 0 && (
        <section className="mt-8">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">live now</div>
          <div className="mt-3 flex flex-col gap-2.5">
            {live.map((g) => (
              <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-accent-dim/50 bg-accent/[0.06] px-4.5 py-3.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-[pulse_1.6s_ease-in-out_infinite] rounded-full bg-accent-dim" />
                </span>
                <div className="min-w-40 flex-1">
                  <div className="text-sm font-medium">{g.title}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-faint">
                    {g.kind} · PIN {g.pin} · {g.player_count} player{g.player_count === 1 ? "" : "s"} · {g.status}
                  </div>
                </div>
                <Link href={`/games/host/${g.id}`} className={BTN_PRIMARY}>
                  open host screen
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <Section
        label="live quizzes"
        newHref="/admin/games/quizzes/new"
        newLabel="+ new quiz"
        empty="No quizzes yet. Make one to run a Kahoot-style round at your next session."
        rows={quizzes}
        render={(q) => (
          <Row
            key={q.id}
            title={q.title}
            meta={`${q.question_count} question${q.question_count === 1 ? "" : "s"}`}
            editHref={`/admin/games/quizzes/${q.id}`}
            busy={busy === q.id}
            hostDisabled={q.question_count === 0}
            onHost={() => host(q.id, { quiz_id: q.id })}
            onDelete={() => remove("quiz", q.id, q.title)}
          />
        )}
      />

      <Section
        label="bingo decks"
        newHref="/admin/games/decks/new"
        newLabel="+ new deck"
        empty="No bingo decks yet. A deck is just a list of 24 or more tech terms."
        rows={decks}
        render={(d) => (
          <Row
            key={d.id}
            title={d.title}
            meta={`${d.term_count} terms`}
            editHref={`/admin/games/decks/${d.id}`}
            busy={busy === d.id}
            onHost={() => host(d.id, { deck_id: d.id })}
            onDelete={() => remove("deck", d.id, d.title)}
          />
        )}
      />
    </div>
  );
}

function Section<T>({
  label,
  newHref,
  newLabel,
  empty,
  rows,
  render,
}: {
  label: string;
  newHref: string;
  newLabel: string;
  empty: string;
  rows: T[] | null;
  render: (row: T) => React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{label}</div>
        <Link href={newHref} className={BTN_PRIMARY}>
          {newLabel}
        </Link>
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        {rows === null ? (
          <p className="text-[13px] text-faint">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong px-4.5 py-5 text-[13.5px] text-muted">{empty}</p>
        ) : (
          rows.map(render)
        )}
      </div>
    </section>
  );
}

function Row({
  title,
  meta,
  editHref,
  busy,
  hostDisabled,
  onHost,
  onDelete,
}: {
  title: string;
  meta: string;
  editHref: string;
  busy: boolean;
  hostDisabled?: boolean;
  onHost: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-strong bg-surface px-4.5 py-3.5">
      <div className="min-w-40 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-0.5 font-mono text-[10px] text-faint">{meta}</div>
      </div>
      <button onClick={onHost} disabled={busy || hostDisabled} className={BTN_PRIMARY}>
        {busy ? "starting…" : "host"}
      </button>
      <Link href={editHref} className={BTN}>
        edit
      </Link>
      <button onClick={onDelete} disabled={busy} className={BTN_DANGER}>
        delete
      </button>
    </div>
  );
}
