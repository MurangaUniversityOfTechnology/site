"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Defaults to true — set false for a non-destructive confirmation (styled with the accent, not danger, color). */
  danger?: boolean;
};

type PendingConfirm = ConfirmOptions & { resolve: (value: boolean) => void };

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  function respond(value: boolean) {
    pending?.resolve(value);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-3/45 p-5"
          onClick={() => respond(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-[0_24px_60px_rgba(15,26,48,0.3)]"
          >
            <h2 id="confirm-dialog-title" className="text-[16px] font-semibold">
              {pending.title}
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{pending.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => respond(false)}
                className="rounded-md border border-border-strong px-4 py-2 text-sm text-muted hover:border-accent-dim"
              >
                Cancel
              </button>
              <button
                onClick={() => respond(true)}
                autoFocus
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  pending.danger === false ? "bg-accent text-[#1a2744]" : "bg-danger text-white"
                }`}
              >
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
