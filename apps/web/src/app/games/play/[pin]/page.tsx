"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError, gameApi, gameToken, type PlayerState } from "@/lib/api";
import { usePoll, useCountdown } from "@/components/games/usePoll";
import { CHOICE_STYLES, ChoiceShape } from "@/components/games/choices";

export default function PlayGamePage() {
  const { pin } = useParams<{ pin: string }>();
  const router = useRouter();
  const [state, setState] = useState<PlayerState | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    if (!gameToken.get(pin)) router.replace(`/games?pin=${pin}`);
  }, [pin, router]);

  const refresh = useCallback(async () => {
    try {
      setState(await gameApi.state(pin));
    } catch (err) {
      // 404 = token unknown/expired, 400 = kicked; anything else is a
      // network blip the next poll will get past.
      if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
        gameToken.clear(pin);
        setFatal(err.message);
      } else {
        throw err;
      }
    }
  }, [pin]);

  const finished = state?.status === "finished";
  usePoll(refresh, 1500, !fatal && !finished);

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-navy text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold">{state?.nickname ?? "…"}</div>
          <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">
            {state?.title ?? `PIN ${pin}`}
          </div>
        </div>
        {state?.kind === "quiz" && (
          <div className="rounded-lg bg-white/10 px-3 py-1.5 text-right">
            <div className="font-mono text-[15px] font-semibold tabular-nums">{state.score.toLocaleString()}</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/45">points</div>
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col px-4 py-5">
        {fatal ? (
          <Centered>
            <p className="text-[18px] font-semibold">{fatal}</p>
            <Link href="/games" className="mt-5 inline-block rounded-xl bg-accent px-5 py-3 font-semibold text-navy">
              Join another game
            </Link>
          </Centered>
        ) : !state ? (
          <Centered>
            <p className="text-white/60">Connecting…</p>
          </Centered>
        ) : state.kind === "quiz" ? (
          <QuizPlayer state={state} pin={pin} onState={setState} />
        ) : (
          <BingoPlayer state={state} pin={pin} />
        )}
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center text-center">{children}</div>;
}

function Lobby({ state }: { state: PlayerState }) {
  return (
    <Centered>
      <div className="grid h-16 w-16 place-items-center rounded-full bg-accent text-[28px] text-navy">✓</div>
      <p className="mt-5 text-[24px] font-semibold tracking-[-0.02em]">You&apos;re in!</p>
      <p className="mt-2 text-white/60">Look for your name on the big screen.</p>
      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
        {state.player_count} player{state.player_count === 1 ? "" : "s"} · waiting for the host
      </p>
    </Centered>
  );
}

// ── quiz ─────────────────────────────────────────────────────────────────

function QuizPlayer({ state, pin, onState }: { state: PlayerState; pin: string; onState: (s: PlayerState) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const questionKey = state.question?.number ?? 0;
  const [prevKey, setPrevKey] = useState(questionKey);
  if (questionKey !== prevKey) {
    setPrevKey(questionKey);
    setPicked([]);
    setError(null);
  }
  const left = useCountdown(state.seconds_left, state);

  if (state.status === "lobby") return <Lobby state={state} />;
  if (state.status === "finished") return <QuizFinished state={state} />;

  const q = state.question;
  if (!q) return <Lobby state={state} />;

  async function submit(choices: number[]) {
    setSending(true);
    setError(null);
    try {
      onState(await gameApi.answer(pin, choices));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Didn't go through — tap again.");
    } finally {
      setSending(false);
    }
  }

  if (state.status === "reveal") return <QuizReveal state={state} />;

  if (state.my_answer) {
    return (
      <Centered>
        <div className="flex gap-2">
          {state.my_answer.choices.map((i) => (
            <span key={i} className={`grid h-14 w-14 place-items-center rounded-xl text-[22px] ${CHOICE_STYLES[i].tile}`}>
              <ChoiceShape index={i} />
            </span>
          ))}
        </div>
        <p className="mt-5 text-[22px] font-semibold">Answer locked in</p>
        <p className="mt-2 text-white/60">Hang tight, waiting for everyone else…</p>
      </Centered>
    );
  }

  const timeUp = left === 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-white/50">
        <span>
          Question {q.number} / {q.count}
        </span>
        <span className={`tabular-nums text-[15px] font-semibold ${left !== null && left <= 5 ? "text-accent" : "text-white"}`}>
          {left ?? ""}s
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-linear"
          style={{ width: `${left === null ? 0 : (left / q.time_limit) * 100}%` }}
        />
      </div>
      <h2 className="mt-5 text-[20px] font-semibold leading-[1.3] tracking-[-0.015em]">{q.prompt}</h2>
      {q.multi && (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-accent">Select all that apply</p>
      )}

      <div className="mt-5 grid flex-1 grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        {q.choices.map((choice, i) => {
          const on = picked.includes(i);
          return (
            <button
              key={i}
              disabled={sending || timeUp}
              onClick={() => {
                if (q.multi) setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
                else submit([i]);
              }}
              aria-pressed={q.multi ? on : undefined}
              className={`flex min-h-20 items-center gap-3 rounded-xl px-4 py-4 text-left text-[16px] font-medium transition active:scale-[0.98] disabled:opacity-60 ${
                CHOICE_STYLES[i].tile
              } ${q.multi && on ? "ring-4 ring-white ring-offset-2 ring-offset-navy" : ""}`}
            >
              <ChoiceShape index={i} className="text-[22px]" />
              <span className="flex-1">{choice}</span>
              {q.multi && <span className="font-mono text-[18px]">{on ? "☑" : "☐"}</span>}
            </button>
          );
        })}
      </div>
      {q.multi && (
        <button
          onClick={() => submit(picked)}
          disabled={sending || timeUp || picked.length === 0}
          className="mt-4 rounded-xl bg-white py-4 text-[16px] font-semibold text-navy disabled:opacity-40"
        >
          {sending ? "Sending…" : `Submit ${picked.length || ""} answer${picked.length === 1 ? "" : "s"}`}
        </button>
      )}
      {timeUp && <p className="mt-3 text-center text-white/60">Time&apos;s up!</p>}
      {error && <p className="mt-3 text-center text-[#ffb4ab]">{error}</p>}
    </div>
  );
}

function QuizReveal({ state }: { state: PlayerState }) {
  const a = state.my_answer;
  const verdict = !a ? "missed" : a.correct ? "correct" : "wrong";
  return (
    <Centered>
      <div
        className={`grid h-20 w-20 place-items-center rounded-full text-[36px] ${
          verdict === "correct" ? "bg-accent text-navy" : "bg-white/10 text-white"
        }`}
      >
        {verdict === "correct" ? "✓" : verdict === "wrong" ? "✕" : "…"}
      </div>
      <p className="mt-5 text-[26px] font-semibold tracking-[-0.02em]">
        {verdict === "correct" ? "Correct!" : verdict === "wrong" ? "Not this time" : "Too slow!"}
      </p>
      {verdict === "correct" && <p className="mt-1 font-mono text-[18px] text-accent">+{a?.points}</p>}
      {state.correct && state.question && (
        <p className="mt-4 max-w-sm text-[14px] text-white/60">
          Answer: {state.correct.map((i) => state.question!.choices[i]).join(", ")}
        </p>
      )}
      <p className="mt-6 rounded-lg bg-white/10 px-4 py-2 font-mono text-[13px]">
        You&apos;re #{state.rank} of {state.player_count}
      </p>
    </Centered>
  );
}

function QuizFinished({ state }: { state: PlayerState }) {
  return (
    <Centered>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">game over</div>
      <p className="mt-3 text-[40px] font-semibold tracking-[-0.03em]">#{state.rank}</p>
      <p className="text-white/60">
        of {state.player_count} · {state.score.toLocaleString()} points
      </p>
      <ol className="mt-8 w-full max-w-sm">
        {state.leaderboard.map((row, i) => (
          <li
            key={row.nickname}
            className={`flex items-center gap-3 border-b border-white/10 py-2.5 ${row.nickname === state.nickname ? "text-accent" : ""}`}
          >
            <span className="w-6 font-mono text-[13px] text-white/45">{i + 1}</span>
            <span className="flex-1 truncate text-left">{row.nickname}</span>
            <span className="font-mono tabular-nums">{row.score.toLocaleString()}</span>
          </li>
        ))}
      </ol>
      <Link href="/games" className="mt-8 text-[14px] text-white/60 underline">
        Join another game
      </Link>
    </Centered>
  );
}

// ── bingo ────────────────────────────────────────────────────────────────

function BingoPlayer({ state, pin }: { state: PlayerState; pin: string }) {
  const marksKey = `game-marks:${pin}`;
  const [marks, setMarks] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(marksKey) ?? "[]");
    } catch {
      return [];
    }
  });
  const [claim, setClaim] = useState<{ ok: boolean; message: string } | null>(null);
  const [claiming, setClaiming] = useState(false);

  function toggle(i: number) {
    if (i === 12) return;
    setMarks((prev) => {
      const next = prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i];
      try {
        localStorage.setItem(marksKey, JSON.stringify(next));
      } catch {
        // marks just won't survive a reload
      }
      return next;
    });
  }

  async function shout() {
    setClaiming(true);
    try {
      await gameApi.claimBingo(pin);
      setClaim({ ok: true, message: "BINGO! It checks out 🎉" });
    } catch (err) {
      setClaim({ ok: false, message: err instanceof ApiError ? err.message : "Couldn't reach the server — try again." });
    } finally {
      setClaiming(false);
    }
  }

  if (state.status === "lobby") return <Lobby state={state} />;
  const card = state.card ?? [];
  const last = state.called[state.called.length - 1];
  const over = state.status === "finished";

  return (
    <div className="flex flex-1 flex-col">
      <div className="rounded-xl bg-white/[0.07] px-4 py-3 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
          {over ? "game over" : last ? `just called · ${state.called.length} so far` : "waiting for the first call"}
        </div>
        <div className="mt-1 min-h-8 text-[22px] font-semibold tracking-[-0.01em] text-accent">{last ?? "…"}</div>
      </div>

      {state.winners.length > 0 && (
        <p className="mt-3 text-center text-[13px] text-white/70">
          🏆 {state.winners.join(", ")} {state.winners.length === 1 ? "has" : "have"} bingo
        </p>
      )}

      <div className="mx-auto mt-4 grid w-full max-w-md grid-cols-5 gap-1.5">
        {card.map((term, i) => {
          const free = i === 12;
          const marked = free || marks.includes(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              aria-pressed={marked}
              className={`flex aspect-square items-center justify-center rounded-lg p-1 text-center text-[clamp(9px,2.7vw,13px)] font-medium leading-tight break-words transition active:scale-95 ${
                free
                  ? "bg-accent font-mono text-navy"
                  : marked
                    ? "bg-accent text-navy"
                    : "bg-white text-navy"
              }`}
            >
              {free ? "FREE" : term}
            </button>
          );
        })}
      </div>

      <button
        onClick={shout}
        disabled={claiming || over || state.has_bingo}
        className="mx-auto mt-5 w-full max-w-md rounded-xl bg-accent py-4 text-[20px] font-bold tracking-[0.08em] text-navy disabled:opacity-40"
      >
        {state.has_bingo ? "You got BINGO ✓" : claiming ? "Checking…" : "BINGO!"}
      </button>
      {claim && (
        <p role="status" className={`mt-3 text-center text-[14px] ${claim.ok ? "text-accent" : "text-[#ffb4ab]"}`}>
          {claim.message}
        </p>
      )}

      {state.called.length > 1 && (
        <details className="mx-auto mt-5 w-full max-w-md text-[13px] text-white/60">
          <summary className="cursor-pointer font-mono text-[10.5px] uppercase tracking-[0.14em]">All called terms</summary>
          <p className="mt-2 leading-[1.7]">{[...state.called].reverse().join(" · ")}</p>
        </details>
      )}
    </div>
  );
}
