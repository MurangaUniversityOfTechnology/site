"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { announcementApi, type Announcement } from "@/lib/api";
import { isFullScreenGame } from "@/lib/gameRoutes";

const DISMISSED_KEY = "dismissed-announcements";
const SHOW_DELAY_MS = 1200;
// Pages where a popup would get in the way of a task in progress.
const QUIET_PREFIXES = ["/admin", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/onboarding", "/welcome"];

function readDismissed(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function rememberDismissed(id: string) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed(), id].slice(-50)));
  } catch {
    // ignore — it just reappears next visit
  }
}

/** Newest live announcement the visitor hasn't dismissed, as a card that
 * floats bottom-right on desktop and above the tab bar on mobile. */
export function AnnouncementCard() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    announcementApi
      .live()
      .then((live) => {
        if (!active) return;
        const dismissed = readDismissed();
        setAnnouncement(live.find((a) => !dismissed.includes(a.id)) ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!announcement) return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [announcement]);

  if (!announcement || !visible) return null;
  if (isFullScreenGame(pathname) || QUIET_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  function dismiss() {
    if (announcement) rememberDismissed(announcement.id);
    setVisible(false);
  }

  return (
    <AnnouncementView announcement={announcement} onDismiss={dismiss} className="fixed inset-x-3 bottom-19 z-30 md:inset-x-auto md:right-6 md:bottom-6 md:w-95" />
  );
}

export function AnnouncementView({
  announcement,
  onDismiss,
  className = "",
}: {
  announcement: Pick<Announcement, "title" | "body" | "cta_label" | "cta_url">;
  onDismiss?: () => void;
  className?: string;
}) {
  const external = !!announcement.cta_url && !announcement.cta_url.startsWith("/");
  const buttonClass =
    "rounded-md bg-accent px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-navy hover:opacity-90";

  return (
    <aside
      role="complementary"
      aria-label="Announcement"
      className={`overflow-hidden rounded-2xl border border-accent/40 bg-navy text-white shadow-[0_18px_48px_rgba(15,26,48,0.38)] motion-safe:animate-[rise_0.35s_ease_both] ${className}`}
    >
      <div className="h-1 bg-linear-to-r from-accent via-accent-dim to-accent" />
      <div className="p-5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-[pulse_2s_ease_infinite]" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">announcement</span>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss announcement"
              className="-mr-1.5 -mt-1.5 ml-auto grid h-8 w-8 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <h2 className="mt-3 text-[19px] font-semibold leading-snug tracking-[-0.02em] text-white">{announcement.title}</h2>
        {announcement.body && <p className="mt-2 text-[14px] leading-[1.55] text-white/75">{announcement.body}</p>}
        {announcement.cta_label && announcement.cta_url && (
          <div className="mt-4 flex items-center gap-4">
            {external ? (
              <a href={announcement.cta_url} target="_blank" rel="noopener noreferrer" onClick={onDismiss} className={buttonClass}>
                {announcement.cta_label} ↗
              </a>
            ) : (
              <Link href={announcement.cta_url} onClick={onDismiss} className={buttonClass}>
                {announcement.cta_label} →
              </Link>
            )}
            {onDismiss && (
              <button type="button" onClick={onDismiss} className="text-[13px] text-white/60 hover:text-white">
                Maybe later
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
