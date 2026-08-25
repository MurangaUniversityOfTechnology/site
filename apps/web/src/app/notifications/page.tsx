"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notificationApi, type Notification } from "@/lib/api";
import { useMe } from "@/lib/useMe";

const KIND_COLOR: Record<string, string> = {
  membership: "text-accent",
  event: "text-warn",
  challenge: "text-accent",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const [items, setItems] = useState<Notification[] | null>(null);

  const load = useCallback(() => {
    notificationApi.list().then(setItems);
  }, []);

  useEffect(() => {
    if (!loading && !me) router.push("/sign-in");
  }, [loading, me, router]);

  useEffect(() => {
    if (!me) return;
    let active = true;
    notificationApi.list().then((result) => {
      if (active) setItems(result);
    });
    return () => {
      active = false;
    };
  }, [me]);

  if (loading || !me) return null;

  async function markRead(n: Notification) {
    if (n.read) return;
    await notificationApi.markRead(n.id);
    load();
  }

  const hasUnread = items?.some((n) => !n.read);

  return (
    <main className="mx-auto max-w-160 px-5 py-12 sm:px-8">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">notifications</div>
          <h1 className="mt-3.5 text-[clamp(28px,4vw,40px)] tracking-[-0.035em]">Your updates</h1>
        </div>
        {hasUnread && (
          <button
            onClick={async () => {
              await notificationApi.markAllRead();
              load();
            }}
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent"
          >
            mark all read
          </button>
        )}
      </div>

      <div className="mt-7 overflow-hidden rounded-xl border border-border bg-surface">
        {items?.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-muted">Nothing yet — this fills up as things happen.</div>
        )}
        {items?.map((n) => (
          <button
            key={n.id}
            onClick={() => markRead(n)}
            className="flex w-full items-start gap-3.5 border-b border-[#14191b] px-5 py-4 text-left last:border-0"
          >
            <span
              className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${n.read ? "bg-transparent" : "bg-warn"}`}
            />
            <div className="min-w-0 flex-1">
              <div className={`text-[15px] ${n.read ? "text-muted" : "text-foreground"}`}>{n.title}</div>
              {n.body && <div className="mt-1 text-[13.5px] text-faint">{n.body}</div>}
              <div className="mt-2 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.08em]">
                <span className={KIND_COLOR[n.kind] ?? "text-faint"}>{n.kind}</span>
                <span className="text-faint">{timeAgo(n.created_at)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}
