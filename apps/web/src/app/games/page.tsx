"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, gameApi, gameToken } from "@/lib/api";
import { useMe } from "@/lib/useMe";

export default function GamesPage() {
  return (
    <Suspense>
      <JoinGame />
    </Suspense>
  );
}

function JoinGame() {
  const router = useRouter();
  const params = useSearchParams();
  const { me } = useMe();
  const [pin, setPin] = useState(() => (params.get("pin") ?? "").replace(/\D/g, "").slice(0, 6));
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await gameApi.join(pin, nickname.trim() || null);
      gameToken.set(res.pin, res.token);
      router.push(`/games/play/${res.pin}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't join — check your connection and try again.");
      setBusy(false);
    }
  }

  const needsNickname = !me;

  return (
    <main className="flex-1">
      <section className="bg-navy px-4 pb-14 pt-12 text-white sm:px-6 sm:pt-16">
        <div className="mx-auto max-w-md">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent">games</div>
          <h1 className="mt-3 text-[clamp(30px,6vw,44px)] font-semibold leading-[1.05] tracking-[-0.035em]">
            Got a PIN? You&apos;re in.
          </h1>
          <p className="mt-3 text-[15px] leading-[1.55] text-white/65">
            Enter the 6-digit PIN on the big screen to join the live quiz or bingo game.
          </p>

          <form onSubmit={join} className="mt-7 flex flex-col gap-3">
            <label className="sr-only" htmlFor="game-pin">
              Game PIN
            </label>
            <input
              id="game-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Game PIN"
              className="w-full rounded-xl border-2 border-white/15 bg-white px-4 py-4 text-center font-mono text-[28px] tracking-[0.3em] text-navy outline-none placeholder:tracking-[0.08em] placeholder:text-faint focus:border-accent"
            />
            {needsNickname && (
              <>
                <label className="sr-only" htmlFor="game-nickname">
                  Nickname
                </label>
                <input
                  id="game-nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.slice(0, 24))}
                  autoComplete="off"
                  placeholder="Nickname"
                  className="w-full rounded-xl border-2 border-white/15 bg-white px-4 py-3.5 text-center text-[18px] text-navy outline-none placeholder:text-faint focus:border-accent"
                />
              </>
            )}
            <button
              type="submit"
              disabled={busy || pin.length !== 6 || (needsNickname && !nickname.trim())}
              className="rounded-xl bg-accent px-4 py-4 text-[16px] font-semibold text-navy hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Joining…" : "Join game"}
            </button>
            {me && (
              <p className="text-center text-[13px] text-white/50">You&apos;ll play under your profile name.</p>
            )}
            {error && (
              <p role="alert" className="rounded-lg bg-danger/15 px-3.5 py-2.5 text-center text-[14px] text-[#ffb4ab]">
                {error}
              </p>
            )}
          </form>
        </div>
      </section>

      <section className="mx-auto grid max-w-3xl gap-4 px-4 py-10 sm:grid-cols-2 sm:px-6">
        <div className="rounded-xl border border-border bg-surface p-5.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">live quiz</div>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.01em]">Fastest right answer wins</h2>
          <p className="mt-1.5 text-[14px] leading-[1.55] text-muted">
            Questions go up on the screen and you answer on your phone. Get it right to score, and answer faster to score
            more. Some questions have more than one right answer, so read carefully.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">tech bingo</div>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.01em]">Five in a row, then shout</h2>
          <p className="mt-1.5 text-[14px] leading-[1.55] text-muted">
            You get your own card of tech terms. The host calls them out, and you mark the ones you hear. Once you have a
            full row, column or diagonal, hit BINGO. We check it, so no bluffing.
          </p>
        </div>
      </section>
    </main>
  );
}
