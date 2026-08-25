"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { profileApi } from "@/lib/api";
import { useMe } from "@/lib/useMe";

const ladder = [
  { label: "account created", color: "text-accent", dot: "bg-accent" },
  { label: "profile ready", color: "text-accent", dot: "bg-accent" },
  { label: "community discovered", color: "text-accent", dot: "bg-accent" },
  { label: "membership", color: "text-warn", dot: "bg-warn" },
];

export default function WelcomePage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !me) router.push("/sign-in");
  }, [loading, me, router]);

  useEffect(() => {
    if (!me) return;
    profileApi
      .me()
      .then((p) => setDisplayName(p.display_name || p.first_name || me.email.split("@")[0]))
      .catch(() => setDisplayName(me.email.split("@")[0]));
  }, [me]);

  if (loading || !me) return null;

  return (
    <main className="relative grid min-h-[calc(100vh-64px)] place-items-center overflow-hidden px-5 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[length:56px_56px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-160 w-160 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,250,138,.08),transparent_62%)]" />

      <div className="relative max-w-130 text-center">
        <div className="mb-10 flex flex-col items-center">
          {ladder.map((l, i) => (
            <div
              key={l.label}
              className="flex flex-col items-center opacity-0"
              style={{ animation: "rise 0.5s ease both", animationDelay: `${i * 0.15}s` }}
            >
              <div className={`flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] ${l.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${l.dot}`} />
                {l.label}
              </div>
              {i < ladder.length - 1 && (
                <div className="h-5.5 w-px bg-[linear-gradient(#1f2729,transparent)]" />
              )}
            </div>
          ))}
        </div>

        <h1 className="m-0 text-[clamp(34px,6vw,64px)] leading-[0.98] tracking-[-0.04em]">
          WELCOME,
          <br />
          <span className="text-accent capitalize">{displayName ?? "…"}.</span>
        </h1>
        <p className="mt-5.5 text-[17px] leading-[1.55] text-[#c8d2cc]">
          You&apos;re officially part of the community.
          <br />
          But there&apos;s one more step.
        </p>
        <p className="mt-3.5 text-[15.5px] leading-[1.55] text-[#7f8d87]">
          Activate your membership to start participating.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-8 animate-[glow_3s_ease-in-out_infinite] rounded-lg bg-accent px-7.5 py-4 text-base font-semibold text-[#04140b] hover:opacity-90"
        >
          Go to Dashboard
        </button>
      </div>
    </main>
  );
}
