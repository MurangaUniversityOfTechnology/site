"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { ApiError, signatureApi } from "@/lib/api";

type Mode = "loading" | "preview" | "draw";

export default function SignaturePanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    signatureApi.status().then((status) => {
      if (!active) return;
      if (!status.has_signature) {
        setMode("draw");
        return;
      }
      signatureApi.image().then((img) => {
        if (!active) return;
        setPreviewSrc(`data:image/png;base64,${img.image_base64}`);
        setSavedAt(img.updated_at);
        setMode("preview");
      });
    });
    return () => {
      active = false;
    };
  }, []);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    padRef.current?.clear();
  }, []);

  useEffect(() => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setupCanvas();
    const pad = new SignaturePad(canvas, { penColor: "#1a2744" });
    pad.addEventListener("endStroke", () => setHasDrawn(!pad.isEmpty()));
    padRef.current = pad;

    const onResize = () => setupCanvas();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      pad.off();
      padRef.current = null;
    };
  }, [mode, setupCanvas]);

  function clearCanvas() {
    padRef.current?.clear();
    setHasDrawn(false);
    setError(null);
  }

  async function save() {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = pad.toDataURL("image/png");
      const status = await signatureApi.save(dataUrl);
      setPreviewSrc(dataUrl);
      setSavedAt(status.updated_at);
      setMode("preview");
      setHasDrawn(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your signature.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSignature() {
    setBusy(true);
    setError(null);
    try {
      await signatureApi.remove();
      setPreviewSrc(null);
      setSavedAt(null);
      setMode("draw");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove your signature.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 max-w-130 rounded-xl border border-border bg-surface p-6">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">digital signature</div>
      <p className="mt-2.5 text-[14px] leading-[1.55] text-muted">
        Draw your signature with a mouse, finger, or stylus. It&apos;s encrypted and stored so it can be reused on
        official documents later.
      </p>

      {mode === "loading" && <div className="mt-5 h-45 animate-pulse rounded-lg bg-[#f0ece0]" />}

      {mode === "preview" && previewSrc && (
        <div className="mt-5">
          <div className="rounded-lg border border-border-strong bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewSrc} alt="Your saved signature" className="h-32 w-full object-contain" />
          </div>
          {savedAt && (
            <p className="mt-2 font-mono text-[10.5px] text-faint">Saved {new Date(savedAt).toLocaleString()}</p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setMode("draw")}
              className="rounded-md border border-border-strong px-4 py-2 text-sm hover:border-accent-dim"
            >
              Redo signature
            </button>
            <button onClick={removeSignature} disabled={busy} className="text-sm text-danger hover:underline disabled:opacity-50">
              Remove
            </button>
          </div>
        </div>
      )}

      {mode === "draw" && (
        <div className="mt-5">
          <canvas ref={canvasRef} className="h-45 w-full touch-none rounded-lg border border-border-strong bg-white" />
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={save}
              disabled={!hasDrawn || busy}
              className="rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save signature"}
            </button>
            <button
              onClick={clearCanvas}
              disabled={!hasDrawn || busy}
              className="rounded-md border border-border-strong px-4 py-2.5 text-sm hover:border-accent-dim disabled:opacity-50"
            >
              Clear &amp; retry
            </button>
            {previewSrc && (
              <button
                onClick={() => setMode("preview")}
                disabled={busy}
                className="text-sm text-faint hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-3.5 text-sm text-danger">{error}</p>}
    </div>
  );
}
