"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
      <div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-warn">something broke</div>
        <h1 className="mt-3.5 text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.035em]">
          That didn&apos;t work.
        </h1>
        <p className="mt-4 text-[15.5px] leading-[1.6] text-[#7a7060]">
          Nothing was lost — try again, or head back home.
        </p>
        <div className="mt-6.5 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-border-strong px-6.5 py-3.5 text-[15px] hover:border-accent-dim"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
