"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { donationApi } from "@/lib/api";

function FailedContent() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!id) return;
    donationApi.status(id).then((d) => setCancelled(d.status === "cancelled")).catch(() => {});
  }, [id]);

  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14">
      <div className="w-full max-w-105 animate-[rise_0.45s_ease_both] text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-[#f6d9d6] bg-danger/10 font-mono text-xl text-danger">
          !
        </div>
        <div className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.18em] text-danger">
          payment {cancelled ? "cancelled" : "failed"}
        </div>
        <h1 className="mt-3.5 text-[clamp(26px,3.6vw,34px)] leading-[1.15] tracking-[-0.03em]">
          Nothing was charged
        </h1>

        <div className="mt-6 rounded-[10px] border border-border bg-surface p-4.5 text-left">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">reason</div>
          <div className="mt-2.5 text-[15.5px] leading-[1.5] text-[#33302b]">
            {cancelled
              ? "You didn't approve the request on your phone in time."
              : "The request timed out on your phone before it was approved."}
          </div>
        </div>

        <p className="mt-5.5 text-[15px] leading-[1.55] text-[#7a7060]">
          If you think money left your account, don&apos;t donate again — reach out to an admin and we&apos;ll check
          with M-Pesa.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push("/donate")}
            className="flex-1 rounded-lg bg-accent py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
          >
            Try Again
          </button>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg border border-border-strong px-5 py-3.5 text-[15px] text-muted"
          >
            Later
          </button>
        </div>
      </div>
    </main>
  );
}

export default function DonateFailedPage() {
  return (
    <Suspense fallback={null}>
      <FailedContent />
    </Suspense>
  );
}
