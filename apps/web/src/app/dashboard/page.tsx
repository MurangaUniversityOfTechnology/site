"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { challenges, events, membershipFeeKes, membershipPerks, projects } from "@/lib/data";
import { useMe } from "@/lib/useMe";

const STATUS_LABEL: Record<string, string> = {
  none: "not started",
  payment_pending: "payment pending",
  payment_received: "payment received",
  approval_pending: "pending approval",
  active: "active",
  rejected: "rejected",
  expired: "expired",
  suspended: "suspended",
};

const STATUS_COLOR: Record<string, string> = {
  none: "text-muted",
  payment_pending: "text-warn",
  payment_received: "text-warn",
  approval_pending: "text-warn",
  active: "text-accent",
  rejected: "text-danger",
  expired: "text-danger",
  suspended: "text-danger",
};

export default function DashboardPage() {
  const router = useRouter();
  const { me, loading, refresh } = useMe();

  useEffect(() => {
    if (!loading && !me) router.push("/sign-in");
  }, [loading, me, router]);

  if (loading || !me) return null;

  const status = me.membership_status;
  const canActivate = status === "none" || status === "rejected" || status === "expired";
  const isPending = status === "payment_pending" || status === "payment_received" || status === "approval_pending";
  const isActive = status === "active";

  return (
    <main className="px-5 py-10 sm:px-8 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent">● system online</div>
      <h1 className="mt-3.5 text-[clamp(30px,5vw,54px)] leading-none tracking-[-0.04em]">
        Welcome back{isActive ? "" : ", builder"}.
      </h1>
      <p className="mt-3.5 text-[16.5px] text-[#9aa6a0]">
        {canActivate && "Your account is ready. Your membership isn't active yet."}
        {isPending && "Your membership application is being reviewed."}
        {isActive && "You have full access to club projects, events and challenges."}
      </p>

      <div className="mt-9 grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          {canActivate && (
            <div className="relative overflow-hidden rounded-xl border border-accent-dim bg-[linear-gradient(160deg,rgba(61,250,138,.055),transparent_60%)] p-6 sm:p-8.5">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent">membership</div>
              <h2 className="mt-3.5 text-[clamp(24px,3.2vw,34px)] tracking-[-0.03em]">You&apos;re one step away.</h2>
              <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {membershipPerks.map((perk) => (
                  <div key={perk} className="flex items-baseline gap-2.5 text-[15px] text-[#c8d2cc]">
                    <span className="font-mono text-xs text-accent">✓</span>
                    {perk}
                  </div>
                ))}
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-4.5 border-t border-border pt-6">
                <div>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">annual</div>
                  <div className="mt-1 font-mono text-[26px] font-bold">KSh {membershipFeeKes}</div>
                </div>
                <Link
                  href="/membership/activate"
                  className="ml-auto rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#04140b] hover:opacity-90"
                >
                  Activate Membership
                </Link>
              </div>
            </div>
          )}

          {isPending && (
            <div className="rounded-xl border border-[#3a3226] bg-warn/[0.04] p-6 sm:p-8.5">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-warn">membership pending</div>
              <h2 className="mt-3.5 text-[clamp(22px,3vw,30px)] tracking-[-0.03em]">You&apos;re almost in.</h2>
              <p className="mt-3.5 text-[15.5px] leading-[1.55] text-[#9aa6a0]">
                Your payment has been confirmed. A club administrator will review your membership. You can continue
                exploring while you wait.
              </p>
            </div>
          )}

          {isActive && (
            <div className="rounded-xl border border-accent-dim bg-[linear-gradient(160deg,rgba(61,250,138,.05),transparent_60%)] p-6 sm:p-8.5">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent">membership active</div>
              <h2 className="mt-3.5 text-[clamp(22px,3vw,30px)] tracking-[-0.03em]">Welcome to the club.</h2>
              <p className="mt-3.5 text-[15.5px] leading-[1.55] text-[#9aa6a0]">
                Join a project, register for an event, or take this week&apos;s challenge.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="flex items-baseline gap-3">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">up next</div>
              <span className="font-mono text-[10.5px] text-faint">this week</span>
            </div>
            <div className="mt-4.5 flex flex-col gap-3">
              {events.slice(0, 3).map((e) => (
                <div key={e.slug} className="flex items-center gap-4 border-b border-[#14191b] py-3.5 last:border-0">
                  <div className="min-w-10 text-center font-mono">
                    <div className="text-[19px] font-bold">{e.day}</div>
                    <div className="text-[9px] tracking-[0.14em] text-faint">{e.mon}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15.5px] font-medium">{e.title}</div>
                    <div className="mt-1 font-mono text-[10.5px] text-[#7f8d87]">{e.meta}</div>
                  </div>
                  {isActive || e.audience === "open to all" ? (
                    <Link
                      href={`/events/${e.slug}`}
                      className="whitespace-nowrap rounded-md border border-accent-dim px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-accent"
                    >
                      view
                    </Link>
                  ) : (
                    <Link
                      href="/membership/activate"
                      className="whitespace-nowrap rounded-md border border-[#3a3226] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-warn"
                    >
                      locked
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-surface p-5.5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">status</div>
            <div className="mt-4 flex flex-col gap-3.5 font-mono text-[11.5px]">
              <div className="flex justify-between">
                <span className="text-faint">account</span>
                <span className="text-accent">complete</span>
              </div>
              <div className="flex justify-between">
                <span className="text-faint">membership</span>
                <span className={STATUS_COLOR[status] ?? "text-muted"}>{STATUS_LABEL[status] ?? status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-faint">email</span>
                <span className="text-muted">{me.email}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5.5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">explore</div>
            <div className="mt-3.5 flex flex-col">
              <ExploreRow href="/projects" label="Projects" count={projects.length} />
              <ExploreRow href="/events" label="Events" count={events.length} />
              <ExploreRow href="/challenges" label="Challenges" count={challenges.length} />
              <ExploreRow href="/learn" label="Learning Paths" count={null} />
              <ExploreRow href="/community" label="Community" count={null} last />
            </div>
          </div>

          <button
            onClick={async () => {
              await authApi.logout();
              await refresh();
              router.push("/");
            }}
            className="w-fit rounded-md border border-border-strong px-4 py-2.5 text-sm text-muted hover:border-accent-dim hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}

function ExploreRow({ href, label, count, last }: { href: string; label: string; count: number | null; last?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex justify-between py-2.5 text-[15px] text-foreground ${last ? "" : "border-b border-[#14191b]"}`}
    >
      {label}
      {count !== null && <span className="text-faint">{count}</span>}
    </Link>
  );
}
