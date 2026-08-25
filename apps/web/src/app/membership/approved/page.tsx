"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/useMe";

export default function ApprovedPage() {
  const router = useRouter();
  const { me, loading } = useMe();

  useEffect(() => {
    if (loading) return;
    if (!me) router.push("/sign-in");
    else if (me.membership_status !== "active") router.push("/dashboard");
  }, [loading, me, router]);

  if (loading || !me || me.membership_status !== "active") return null;

  return (
    <main className="relative grid min-h-[calc(100vh-64px)] place-items-center overflow-hidden px-5 py-16">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-190 w-190 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,250,138,.12),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(61,250,138,.03)_1px,transparent_1px)] bg-[length:100%_8px]" />

      <div className="relative max-w-130 text-center">
        <div className="inline-flex animate-[rise_0.5s_ease_both] items-center gap-2 rounded-md border border-accent-dim bg-accent/[0.06] px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
          <span className="h-1.5 w-1.5 animate-[pulse_1.6s_infinite] rounded-full bg-accent" />
          member access · online
        </div>
        <h1
          className="mt-6.5 animate-[rise_0.5s_ease_both] text-[clamp(38px,7.5vw,88px)] leading-[0.92] tracking-[-0.045em]"
          style={{ animationDelay: "0.1s" }}
        >
          YOU&apos;RE
          <br />
          <span className="text-accent">IN.</span>
        </h1>
        <p
          className="mt-6 animate-[rise_0.5s_ease_both] text-[17.5px] leading-[1.55] text-[#c8d2cc]"
          style={{ animationDelay: "0.2s" }}
        >
          Your MUT Tech Community membership is active.
          <br />
          The community is waiting.
        </p>

        <div
          className="mt-8 flex animate-[rise_0.5s_ease_both] justify-center gap-px overflow-hidden rounded-[10px] border border-border bg-border"
          style={{ animationDelay: "0.3s" }}
        >
          <div className="bg-surface px-5.5 py-4">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">member since</div>
            <div className="mt-1.5 font-mono text-[15px]">{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</div>
          </div>
        </div>

        <button
          onClick={() => router.push("/community")}
          className="mt-8 animate-[glow_2.6s_ease-in-out_infinite] rounded-lg bg-accent px-8 py-4 text-base font-semibold text-[#04140b] hover:opacity-90"
        >
          Explore the Community
        </button>
      </div>
    </main>
  );
}
