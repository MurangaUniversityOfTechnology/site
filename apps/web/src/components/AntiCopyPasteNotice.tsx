"use client";

import { useState } from "react";

export function AntiCopyPasteNotice({ onAcknowledged }: { onAcknowledged: (ok: boolean) => void }) {
  const [first, setFirst] = useState(false);
  const [second, setSecond] = useState(false);

  function toggleFirst() {
    const next = !first;
    setFirst(next);
    if (!next) {
      setSecond(false);
      onAcknowledged(false);
    }
  }

  function toggleSecond() {
    const next = !second;
    setSecond(next);
    onAcknowledged(first && next);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#f0dfb8] bg-warn/[0.04] px-4.5 py-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-warn">before you begin</div>
      <label className="flex items-start gap-2.5 text-[13.5px] text-muted">
        <input type="checkbox" checked={first} onChange={toggleFirst} className="mt-0.5 accent-accent" />
        <span>
          I solemnly swear I will not open a second tab, ask a friend, or summon an AI to answer these questions for
          me.
        </span>
      </label>
      {first && (
        <label className="flex items-start gap-2.5 text-[13.5px] text-muted">
          <input type="checkbox" checked={second} onChange={toggleSecond} className="mt-0.5 accent-accent" />
          <span>
            I understand that copy-pasting this exam into a chatbot would be, at minimum, extremely on-the-nose
            given who&apos;s asking.
          </span>
        </label>
      )}
    </div>
  );
}
