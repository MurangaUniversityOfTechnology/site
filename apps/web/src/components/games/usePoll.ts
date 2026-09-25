"use client";

import { useEffect, useRef, useState } from "react";

/** Calls `fn` now and every `ms` after, skipping ticks while the tab is
 * hidden (a phone in a pocket shouldn't keep hammering the API) and never
 * overlapping two in-flight calls on a slow connection. */
export function usePoll(fn: () => Promise<unknown>, ms: number, enabled = true) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!enabled) return;
    let inFlight = false;
    let cancelled = false;
    // The first load always runs, even in a background tab, so the page
    // never sits on "Loading…" — only the repeat ticks pause while hidden.
    const tick = async (force = false) => {
      if (inFlight || cancelled || (!force && document.visibilityState === "hidden")) return;
      inFlight = true;
      try {
        await fnRef.current();
      } catch {
        // the next tick retries — flaky wifi mid-game is normal
      } finally {
        inFlight = false;
      }
    };
    const onVisible = () => tick();
    tick(true);
    const id = setInterval(tick, ms);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms, enabled]);
}

/** Smooth countdown between polls: each poll's server-side seconds_left
 * (`anchor` changes on every poll) restarts a local tick-down from it —
 * the phone's own clock is only ever used for the delta, never trusted
 * for the deadline itself. */
export function useCountdown(secondsLeft: number | null, anchor: unknown): number | null {
  const [elapsed, setElapsed] = useState(0);
  const [prevAnchor, setPrevAnchor] = useState(anchor);
  if (anchor !== prevAnchor) {
    setPrevAnchor(anchor);
    setElapsed(0);
  }

  useEffect(() => {
    if (secondsLeft === null) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(id);
  }, [secondsLeft, anchor]);

  return secondsLeft === null ? null : Math.max(0, secondsLeft - elapsed);
}
