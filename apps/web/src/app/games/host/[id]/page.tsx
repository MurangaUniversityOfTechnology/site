"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { ApiError, adminApi, type HostState } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { signInHref } from "@/lib/nextParam";
import { useConfirm } from "@/components/ConfirmDialog";
import { usePoll, useCountdown } from "@/components/games/usePoll";
import { CHOICE_STYLES, ChoiceShape } from "@/components/games/choices";

// The projector view. Lives outside /admin on purpose so none of the admin
// chrome ends up on the big screen, but it's still staff-only, both here
// and on every API call it makes.
export default function HostGamePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me, loading } = useMe();
  const confirm = useConfirm();
  const [state, setState] = useState<HostState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allowed = !!me && (me.is_admin || me.is_staff);
  useEffect(() => {
    if (loading) return;
    if (!me) router.push(signInHref(`/games/host/${id}`));
    else if (!allowed) router.push("/games");
  }, [loading, me, allowed, router, id]);

  const refresh = useCallback(async () => setState(await adminApi.hostState(id)), [id]);
  usePoll(refresh, 1000, allowed && state?.status !== "finished");

  async function run(action: () => Promise<HostState>) {
    setBusy(true);
    setError(null);
    try {
      setState(await action());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function kick(playerId: string, nickname: string) {
    const ok = await confirm({ title: `Remove ${nickname}?`, message: "They'll be kicked out of this game and can't rejoin it." });
    if (ok) run(() => adminApi.kickPlayer(id, playerId));
  }

  async function end() {
    const ok = await confirm({ title: "End this game?", message: "Players will see the final results and the PIN stops working." });
    if (ok) run(() => adminApi.endGame(id));
  }

  if (!allowed || !state) {
    return <main className="grid min-h-dvh flex-1 place-items-center bg-navy-3 text-white/60">Loading game…</main>;
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-navy-3 text-white">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/10 px-5 py-3 sm:px-8">
        <Link href="/admin/games" className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/50 hover:text-white">
          ← games
        </Link>
        <div className="min-w-0 flex-1 truncate text-[15px] font-semibold">{state.title}</div>
        <div className="font-mono text-[13px] text-white/60">
          PIN <span className="text-[18px] font-semibold tracking-[0.12em] text-accent">{state.pin}</span>
        </div>
        <div className="font-mono text-[12px] text-white/60">{state.players.length} playing</div>
        {state.status !== "finished" && (
          <button
            onClick={end}
            className="rounded-md border border-white/20 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/70 hover:bg-white/10"
          >
            end game
          </button>
        )}
      </header>

      <div className="flex flex-1 flex-col px-5 py-6 sm:px-10 sm:py-8">
        {state.status === "lobby" ? (
          <HostLobby state={state} onKick={kick} />
        ) : state.kind === "quiz" ? (
          <HostQuiz state={state} />
        ) : (
          <HostBingo state={state} />
        )}
      </div>

      {state.status !== "finished" && (
        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-white/10 bg-navy-3/95 px-5 py-4 backdrop-blur sm:px-8">
          {error && <p className="mr-auto text-[14px] text-[#ffb4ab]">{error}</p>}
          <button
            onClick={() => run(() => adminApi.advanceGame(id))}
            disabled={busy || (state.status === "lobby" && state.players.length === 0) || (state.kind === "bingo" && state.status === "playing" && state.terms_left === 0)}
            className="rounded-xl bg-accent px-7 py-3.5 text-[17px] font-semibold text-navy hover:opacity-90 disabled:opacity-40"
          >
            {nextLabel(state)}
          </button>
        </footer>
      )}
    </main>
  );
}

function nextLabel(s: HostState): string {
  if (s.status === "lobby") return s.players.length === 0 ? "Waiting for players…" : "Start game →";
  if (s.kind === "bingo") return s.terms_left === 0 ? "Every term called" : s.called.length === 0 ? "Call the first term →" : "Call next term →";
  if (s.status === "question") return "Show answer";
  return s.question_number >= s.question_count ? "Final results →" : "Next question →";
}

// ── lobby ────────────────────────────────────────────────────────────────

function HostLobby({ state, onKick }: { state: HostState; onKick: (playerId: string, nickname: string) => void }) {
  // Safe to read window here: this only renders once the first poll has
  // landed, which never happens during server rendering.
  const joinUrl = `${window.location.origin}/games?pin=${state.pin}`;
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(joinUrl, { width: 360, margin: 1, color: { dark: "#1a2744", light: "#ffffff" } }).then(setQr);
  }, [joinUrl]);

  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14">
        <div className="text-center">
          <div className="font-mono text-[12px] uppercase tracking-[0.2em] text-white/50">
            Go to <span className="text-white">{joinUrl.replace(/^https?:\/\//, "").replace(/\?.*$/, "")}</span> and enter
          </div>
          <div className="mt-3 font-mono text-[clamp(56px,11vw,128px)] font-semibold leading-none tracking-[0.1em] text-accent">
            {state.pin}
          </div>
        </div>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element -- a generated data: URL, nothing for next/image to optimise
          <img src={qr} alt={`QR code to join game ${state.pin}`} className="h-40 w-40 rounded-xl bg-white p-2 sm:h-48 sm:w-48" />
        )}
      </div>

      <div className="mt-10 w-full max-w-5xl">
        <div className="text-center font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
          {state.players.length === 0 ? "Waiting for players to join…" : "Tap a name to remove it"}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2.5">
          {state.players.map((p) => (
            <button
              key={p.id}
              onClick={() => onKick(p.id, p.nickname)}
              title="Remove player"
              className="animate-[rise_0.3s_ease_both] rounded-full bg-white/10 px-4 py-2 text-[16px] font-medium hover:bg-danger/60 hover:line-through"
            >
              {p.nickname}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── quiz ─────────────────────────────────────────────────────────────────

function HostQuiz({ state }: { state: HostState }) {
  const left = useCountdown(state.seconds_left, state);
  if (state.status === "finished") return <Podium state={state} />;
  const q = state.question;
  if (!q) return null;
  const revealed = state.status === "reveal";
  const maxCount = Math.max(1, ...(state.choice_counts ?? [0]));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
      <div className="flex items-center justify-between font-mono text-[12px] uppercase tracking-[0.16em] text-white/50">
        <span>
          Question {state.question_number} / {state.question_count}
          {q.correct.length > 1 && <span className="ml-3 text-accent">select all that apply</span>}
        </span>
        <span>
          {state.answered_count} / {state.players.length} answered
        </span>
      </div>

      <div className="mt-6 flex items-start gap-6">
        <h2 className="flex-1 text-[clamp(24px,3.6vw,44px)] font-semibold leading-[1.15] tracking-[-0.025em]">{q.prompt}</h2>
        {!revealed && (
          <div className="grid h-20 w-20 flex-none place-items-center rounded-full border-4 border-accent font-mono text-[30px] font-semibold tabular-nums sm:h-24 sm:w-24 sm:text-[36px]">
            {left}
          </div>
        )}
      </div>

      <div className="mt-8 grid content-start gap-4 sm:grid-cols-2">
        {q.choices.map((choice, i) => {
          const isCorrect = q.correct.includes(i);
          const count = state.choice_counts?.[i] ?? 0;
          return (
            <div
              key={i}
              className={`relative flex min-h-24 items-center gap-4 overflow-hidden rounded-2xl px-6 py-5 text-[clamp(18px,2.2vw,26px)] font-medium transition ${
                CHOICE_STYLES[i].tile
              } ${revealed && !isCorrect ? "opacity-30" : ""}`}
            >
              <ChoiceShape index={i} className="text-[28px]" />
              <span className="flex-1">{choice}</span>
              {revealed && (
                <span className="flex items-center gap-3 font-mono text-[20px]">
                  {isCorrect && "✓"}
                  <span className="tabular-nums">{count}</span>
                </span>
              )}
              {revealed && (
                <span
                  className="absolute inset-x-0 bottom-0 h-1.5 bg-current opacity-40"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              )}
            </div>
          );
        })}
      </div>

      {revealed && <Leaderboard state={state} />}
    </div>
  );
}

function Leaderboard({ state }: { state: HostState }) {
  const top = state.players.slice(0, 5);
  if (top.length === 0) return null;
  return (
    <div className="mt-8 rounded-2xl bg-white/[0.06] p-5">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">leaderboard</div>
      <ol className="mt-3 grid gap-x-8 sm:grid-cols-2">
        {top.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 border-b border-white/10 py-2 text-[18px]">
            <span className="w-6 font-mono text-[14px] text-white/45">{i + 1}</span>
            <span className="flex-1 truncate">{p.nickname}</span>
            <span className="font-mono tabular-nums text-accent">{p.score.toLocaleString()}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PodiumStep({ p, place, height }: { p?: HostState["players"][number]; place: number; height: string }) {
  return (
    <div className="flex w-[30%] max-w-56 flex-col items-center">
      <div className="mb-3 w-full truncate text-center text-[clamp(16px,2.2vw,26px)] font-semibold">{p?.nickname ?? "—"}</div>
      <div className="mb-2 font-mono text-[15px] text-accent">{p ? p.score.toLocaleString() : ""}</div>
      <div
        className={`grid w-full place-items-start justify-center rounded-t-xl pt-4 font-mono text-[40px] font-semibold ${height} ${
          place === 1 ? "bg-accent text-navy" : "bg-white/10 text-white"
        }`}
      >
        {place}
      </div>
    </div>
  );
}

function Podium({ state }: { state: HostState }) {
  const [first, second, third] = state.players;
  const rest = state.players.slice(3, 10);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center">
      <div className="font-mono text-[12px] uppercase tracking-[0.2em] text-accent">final results</div>
      <div className="mt-10 flex w-full items-end justify-center gap-3">
        <PodiumStep p={second} place={2} height="h-32" />
        <PodiumStep p={first} place={1} height="h-48" />
        <PodiumStep p={third} place={3} height="h-24" />
      </div>
      {rest.length > 0 && (
        <ol start={4} className="mt-8 w-full max-w-md">
          {rest.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 border-b border-white/10 py-2">
              <span className="w-6 font-mono text-[13px] text-white/45">{i + 4}</span>
              <span className="flex-1 truncate">{p.nickname}</span>
              <span className="font-mono tabular-nums">{p.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── bingo ────────────────────────────────────────────────────────────────

function HostBingo({ state }: { state: HostState }) {
  const last = state.called[state.called.length - 1];
  const earlier = state.called.slice(0, -1).reverse();
  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="rounded-3xl bg-white/[0.06] px-6 py-10 text-center">
          <div className="font-mono text-[12px] uppercase tracking-[0.2em] text-white/45">
            {state.status === "finished" ? "game over" : last ? `call #${state.called.length}` : "ready when you are"}
          </div>
          <div key={last} className="mt-4 animate-[rise_0.35s_ease_both] text-[clamp(40px,7vw,96px)] font-semibold leading-[1.05] tracking-[-0.03em] text-accent">
            {last ?? "Tech Bingo"}
          </div>
        </div>
        {earlier.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {earlier.map((t) => (
              <span key={t} className="rounded-full bg-white/10 px-3.5 py-1.5 text-[15px] text-white/80">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <aside className="rounded-2xl bg-white/[0.06] p-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">winners</div>
        {state.winners.length === 0 ? (
          <p className="mt-3 text-white/50">No bingo yet. {state.terms_left} terms left to call.</p>
        ) : (
          <ol className="mt-3">
            {state.winners.map((w, i) => (
              <li key={w} className="flex items-center gap-3 border-b border-white/10 py-2.5 text-[20px]">
                <span className="font-mono text-[14px] text-accent">{i === 0 ? "🏆" : i + 1}</span>
                <span className="truncate">{w}</span>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
