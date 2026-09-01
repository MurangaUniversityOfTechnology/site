"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi, eventApi, githubApi, projectApi, type EventSummary, type GithubStatus } from "@/lib/api";
import { challenges, membershipFeeKes, membershipPerks } from "@/lib/data";
import { formatEventDay } from "@/lib/eventFormat";
import { useMe } from "@/lib/useMe";
import { useSignOut } from "@/lib/useSignOut";

const STATUS_LABEL: Record<string, string> = {
  none: "not started",
  payment_pending: "payment pending",
  payment_received: "payment received",
  active: "active",
  expired: "expired",
  suspended: "suspended",
};

const STATUS_COLOR: Record<string, string> = {
  none: "text-muted",
  payment_pending: "text-warn",
  payment_received: "text-warn",
  active: "text-navy",
  expired: "text-danger",
  suspended: "text-danger",
};

export default function DashboardPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const signOut = useSignOut();
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [githubStatus, setGithubStatus] = useState<GithubStatus | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.push("/sign-in");
  }, [loading, me, router]);

  useEffect(() => {
    let active = true;
    projectApi.list().then((result) => {
      if (active) setProjectCount(result.length);
    });
    eventApi.list().then((result) => {
      if (active) setEvents(result);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!me) return;
    let active = true;
    githubApi.status().then((result) => {
      if (active) setGithubStatus(result);
    });
    return () => {
      active = false;
    };
  }, [me]);

  if (loading || !me) return null;

  const status = me.membership_status;
  // Admins get full access regardless of payment status (see the backend
  // checks this mirrors) — never nag them to activate/pay.
  const canActivate = !me.is_admin && (status === "none" || status === "expired");
  const isPending = !me.is_admin && (status === "payment_pending" || status === "payment_received");
  const isActive = me.is_admin || status === "active";

  async function sendVerification() {
    setSendingVerification(true);
    try {
      await authApi.sendVerificationEmail();
      setVerificationSent(true);
    } finally {
      setSendingVerification(false);
    }
  }

  return (
    <main className="px-5 py-10 sm:px-8 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-navy">● system online</div>
      <h1 className="mt-3.5 text-[clamp(30px,5vw,54px)] leading-none tracking-[-0.04em]">
        Welcome back{isActive ? "" : ", builder"}.
      </h1>
      <p className="mt-3.5 text-[16.5px] text-[#7a7060]">
        {canActivate && "Your account is ready. Your membership isn't active yet."}
        {isPending && "Waiting for your M-Pesa payment to confirm."}
        {isActive && "You have full access to club projects, events and challenges."}
      </p>

      {!me.email_verified && (
        <div className="mt-5 flex flex-wrap items-center gap-3.5 rounded-lg border border-[#f0dfb8] bg-warn/[0.04] px-4.5 py-3.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-warn">unverified email</span>
          <span className="text-[14px] text-[#7a7060]">Confirm {me.email} to secure your account.</span>
          {verificationSent ? (
            <span className="ml-auto font-mono text-[11.5px] text-navy">sent — check your inbox</span>
          ) : (
            <button
              onClick={sendVerification}
              disabled={sendingVerification}
              className="ml-auto whitespace-nowrap rounded-md border border-border-strong px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted hover:border-accent-dim disabled:opacity-50"
            >
              {sendingVerification ? "sending…" : "resend link"}
            </button>
          )}
        </div>
      )}

      {isActive && githubStatus && !githubStatus.linked && (
        <div className="mt-5 flex flex-wrap items-center gap-3.5 rounded-lg border border-accent-dim bg-accent/[0.04] px-4.5 py-3.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy">join the github org</span>
          <span className="text-[14px] text-[#7a7060]">Link GitHub to get pushed straight into the club org.</span>
          <Link
            href="/github"
            className="ml-auto whitespace-nowrap rounded-md border border-accent-dim px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-navy hover:bg-accent/10"
          >
            Link GitHub
          </Link>
        </div>
      )}

      <div className="mt-9 grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          {canActivate && (
            <div className="relative overflow-hidden rounded-xl border border-accent-dim bg-[linear-gradient(160deg,rgba(201,168,76,.055),transparent_60%)] p-6 sm:p-8.5">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-navy">membership</div>
              <h2 className="mt-3.5 text-[clamp(24px,3.2vw,34px)] tracking-[-0.03em]">You&apos;re one step away.</h2>
              <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {membershipPerks.map((perk) => (
                  <div key={perk} className="flex items-baseline gap-2.5 text-[15px] text-[#33302b]">
                    <span className="font-mono text-xs text-navy">✓</span>
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
                  className="ml-auto rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
                >
                  Activate Membership
                </Link>
              </div>
            </div>
          )}

          {isPending && (
            <div className="rounded-xl border border-[#f0dfb8] bg-warn/[0.04] p-6 sm:p-8.5">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-warn">membership pending</div>
              <h2 className="mt-3.5 text-[clamp(22px,3vw,30px)] tracking-[-0.03em]">You&apos;re almost in.</h2>
              <p className="mt-3.5 text-[15.5px] leading-[1.55] text-[#7a7060]">
                We&apos;re waiting on M-Pesa to confirm your payment — it activates automatically the moment it does.
                You can continue exploring while you wait.
              </p>
            </div>
          )}

          {isActive && (
            <div className="rounded-xl border border-accent-dim bg-[linear-gradient(160deg,rgba(201,168,76,.05),transparent_60%)] p-6 sm:p-8.5">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-navy">membership active</div>
              <h2 className="mt-3.5 text-[clamp(22px,3vw,30px)] tracking-[-0.03em]">Welcome to the club.</h2>
              <p className="mt-3.5 text-[15.5px] leading-[1.55] text-[#7a7060]">
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
              {events?.length === 0 && <p className="py-2 text-sm text-muted">No events coming up this week.</p>}
              {(events ?? []).slice(0, 3).map((e) => {
                const { day, mon } = formatEventDay(e.starts_at);
                return (
                  <div key={e.slug} className="flex items-center gap-4 border-b border-[#e8e1d2] py-3.5 last:border-0">
                    <div className="min-w-10 text-center font-mono">
                      <div className="text-[19px] font-bold">{day}</div>
                      <div className="text-[9px] tracking-[0.14em] text-faint">{mon}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15.5px] font-medium">{e.title}</div>
                      <div className="mt-1 font-mono text-[10.5px] text-[#8f8368]">{e.venue}</div>
                    </div>
                    {isActive || e.audience === "open_to_all" ? (
                      <Link
                        href={`/events/${e.slug}`}
                        className="whitespace-nowrap rounded-md border border-accent-dim px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-navy"
                      >
                        view
                      </Link>
                    ) : (
                      <Link
                        href="/membership/activate"
                        className="whitespace-nowrap rounded-md border border-[#f0dfb8] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-warn"
                      >
                        locked
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-surface p-5.5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">status</div>
            <div className="mt-4 flex flex-col gap-3.5 font-mono text-[11.5px]">
              <div className="flex justify-between">
                <span className="text-faint">account</span>
                <span className="text-navy">complete</span>
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
              <ExploreRow href="/projects" label="Projects" count={projectCount} />
              <ExploreRow href="/events" label="Events" count={events?.length ?? null} />
              <ExploreRow href="/challenges" label="Challenges" count={challenges.length} />
              <ExploreRow href="/learn" label="Learning Paths" count={null} />
              <ExploreRow href="/community" label="Community" count={null} />
              <ExploreRow href="/github" label="GitHub" count={null} />
              <ExploreRow href="/membership/renew" label="Membership" count={null} />
              <ExploreRow href="/settings" label="Settings" count={null} last />
            </div>
          </div>

          <button
            onClick={signOut}
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
      className={`flex justify-between py-2.5 text-[15px] text-foreground ${last ? "" : "border-b border-[#e8e1d2]"}`}
    >
      {label}
      {count !== null && <span className="text-faint">{count}</span>}
    </Link>
  );
}
