"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { adminApi, type AdminEventRow, type AdminRegistrationRow } from "@/lib/api";

// Must match TICKET_QR_PREFIX in events/[slug]/pass/page.tsx.
const TICKET_QR_PREFIX = "mut-ticket:";
const RESCAN_COOLDOWN_MS = 3000;

type Feedback = { kind: "success" | "error" | "info"; text: string };

export default function CheckinPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [event, setEvent] = useState<AdminEventRow | null>(null);
  const [rows, setRows] = useState<AdminRegistrationRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const rowsRef = useRef<AdminRegistrationRow[] | null>(null);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  const lastScan = useRef<{ id: string; at: number } | null>(null);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);

  const load = useCallback(() => {
    adminApi.eventRegistrations(slug).then(setRows);
    adminApi.listEvents().then((events) => setEvent(events.find((e) => e.slug === slug) ?? null));
  }, [slug]);

  useEffect(load, [load]);

  const checkIn = useCallback(async (row: AdminRegistrationRow) => {
    if (row.status === "attended") {
      setFeedback({ kind: "info", text: `${row.name} is already checked in.` });
      return;
    }
    if (row.status !== "approved") {
      setFeedback({ kind: "error", text: `${row.name}'s registration is "${row.status}" — not cleared for entry.` });
      return;
    }
    setBusyId(row.id);
    try {
      await adminApi.attendRegistration(row.id);
      setRows((r) => r?.map((x) => (x.id === row.id ? { ...x, status: "attended" } : x)) ?? null);
      setFeedback({ kind: "success", text: `${row.name} checked in ✓` });
    } catch {
      setFeedback({ kind: "error", text: `Couldn't check ${row.name} in — try again.` });
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleDecoded = useCallback(
    (decodedText: string) => {
      if (!decodedText.startsWith(TICKET_QR_PREFIX)) {
        setFeedback({ kind: "error", text: "That QR code isn't a MUT Tech event ticket." });
        return;
      }
      const id = decodedText.slice(TICKET_QR_PREFIX.length);

      const now = Date.now();
      if (lastScan.current && lastScan.current.id === id && now - lastScan.current.at < RESCAN_COOLDOWN_MS) {
        return; // same ticket still in frame — don't re-fire
      }
      lastScan.current = { id, at: now };

      const row = rowsRef.current?.find((r) => r.id === id);
      if (!row) {
        setFeedback({ kind: "error", text: "This ticket isn't for this event." });
        return;
      }
      checkIn(row);
    },
    [checkIn],
  );

  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          (decodedText) => handleDecoded(decodedText),
          undefined,
        )
        .catch((err: unknown) => {
          setCameraError(err instanceof Error ? err.message : "Couldn't access the camera.");
        });
    });

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [cameraOn, handleDecoded]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const filtered =
    query.trim().length === 0
      ? []
      : (rows ?? []).filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="max-w-160">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">check-in</div>
          <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">{event?.title ?? slug}</h1>
        </div>
        <Link
          href={`/admin/events/${slug}`}
          className="rounded-md border border-border-strong px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted hover:border-accent-dim"
        >
          Full roster →
        </Link>
      </div>

      {feedback && (
        <div
          className={`mt-5 rounded-lg border px-4.5 py-3.5 text-[14.5px] ${
            feedback.kind === "success"
              ? "border-accent-dim bg-accent/[0.06] text-navy"
              : feedback.kind === "error"
                ? "border-[#f6d9d6] bg-danger/[0.05] text-danger"
                : "border-[#f0dfb8] bg-warn/[0.05] text-warn"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">scan ticket</div>
          <button
            type="button"
            onClick={() => {
              setCameraError(null);
              setCameraOn((c) => !c);
            }}
            className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted hover:text-foreground"
          >
            {cameraOn ? "turn camera off" : "turn camera on"}
          </button>
        </div>

        {cameraOn ? (
          <div className="mt-3.5 overflow-hidden rounded-lg border border-border-strong">
            <div id="qr-reader" className="mx-auto max-w-90" />
          </div>
        ) : (
          <div className="mt-3.5 rounded-lg border border-dashed border-border-strong bg-background p-8 text-center text-sm text-muted">
            Camera is off — search by name below instead.
          </div>
        )}
        {cameraError && <p className="mt-3 text-sm text-danger">{cameraError}</p>}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">or search by name</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Start typing a name…"
          className="mt-3 w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
        {query.trim().length > 0 && (
          <div className="mt-4 flex flex-col">
            {filtered.length === 0 && <p className="py-3 text-sm text-muted">No match for &ldquo;{query}&rdquo;.</p>}
            {filtered.map((r) => (
              <div key={r.id} className="flex items-center gap-3.5 border-b border-[#e8e1d2] py-3.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium">{r.name}</div>
                  <div className="mt-0.5 font-mono text-[10.5px] text-faint">
                    {r.detail} · {r.status}
                  </div>
                </div>
                <button
                  onClick={() => checkIn(r)}
                  disabled={busyId === r.id || r.status === "attended"}
                  className="whitespace-nowrap rounded-md border border-accent-dim px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-navy disabled:opacity-50"
                >
                  {r.status === "attended" ? "checked in" : busyId === r.id ? "checking in…" : "check in"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
