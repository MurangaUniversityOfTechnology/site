"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, githubApi, type GithubStatus } from "@/lib/api";
import { useMe } from "@/lib/useMe";

const INVITE_COPY: Record<string, { tag: string; title: string; body: string }> = {
  invited: {
    tag: "org invitation sent",
    title: "Check your GitHub email",
    body: "An invitation to push to club repos is waiting. Accept it and you're in.",
  },
  accepted: {
    tag: "in the org",
    title: "You're in the club's GitHub org",
    body: "You can push to club repos.",
  },
  expired: {
    tag: "invitation expired",
    title: "That invite timed out",
    body: "GitHub invitations expire after seven days. Ask an admin to re-send it.",
  },
};

export default function GithubConnectPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !me) router.push("/sign-in");
  }, [loading, me, router]);

  useEffect(() => {
    if (!me) return;
    let active = true;
    githubApi.status().then((result) => {
      if (active) setStatus(result);
    });
    return () => {
      active = false;
    };
  }, [me]);

  if (loading || !me || !status) return null;

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await githubApi.revoke();
      setStatus({ linked: false, login: null, invite_status: "none" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't revoke — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (status.linked) {
    const invite = INVITE_COPY[status.invite_status];
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14">
        <div className="w-full max-w-115">
          <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
            <span className="h-1.5 w-1.5 animate-[pulse_1.8s_infinite] rounded-full bg-accent" />
            github linked
          </div>
          <h1 className="mt-4.5 text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.035em]">
            github.com/{status.login}
          </h1>

          {invite && (
            <div className="mt-7 rounded-xl border border-border bg-surface p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-warn">{invite.tag}</div>
              <div className="mt-2.5 text-[17px] font-medium">{invite.title}</div>
              <p className="mt-2 text-[14.5px] leading-[1.6] text-muted">{invite.body}</p>
            </div>
          )}

          <div className="mt-7 rounded-xl border border-border bg-surface p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">what this connection can do</div>
            <p className="mt-2.5 text-[14.5px] leading-[1.6] text-muted">
              Write to your repos, read private code, or open anything on your behalf. Read-only, and you can revoke
              it here or from GitHub.
            </p>
          </div>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}
          <button
            onClick={revoke}
            disabled={busy}
            className="mt-6.5 rounded-lg border border-[#5a3330] px-6.5 py-3.5 text-[15px] font-semibold text-danger hover:bg-danger/5 disabled:opacity-50"
          >
            {busy ? "Revoking…" : "Revoke access"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14">
      <div className="w-full max-w-115">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">connect github</div>
        <h1 className="mt-4.5 text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.035em]">
          Link your GitHub account
        </h1>
        <p className="mt-4 text-[15.5px] leading-[1.6] text-[#9aa6a0]">
          Link GitHub and the work you already do shows up here — challenge submissions verified automatically, and
          an org invite goes out the moment your membership activates.
        </p>
        <a
          href={githubApi.startUrl()}
          className="mt-6.5 inline-block rounded-lg bg-[#f2f5f3] px-6.5 py-3.5 text-[15px] font-semibold text-[#0b0f10] hover:opacity-90"
        >
          Continue with GitHub
        </a>
      </div>
    </main>
  );
}
