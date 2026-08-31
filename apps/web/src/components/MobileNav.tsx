"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/lib/useMe";
import { useUnreadCount } from "@/lib/useUnreadCount";

const MORE_LINKS = [
  { href: "/projects", label: "Projects" },
  { href: "/challenges", label: "Challenges" },
  { href: "/learn", label: "Learn" },
  { href: "/members", label: "People" },
];

const MORE_PREFIXES = ["/projects", "/challenges", "/learn", "/members"];

export function MobileNav() {
  const pathname = usePathname();
  const { me } = useMe();
  const unread = useUnreadCount(me, pathname);
  const [open, setOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  if (pathname?.startsWith("/admin")) return null;

  const onHome = pathname === "/";
  const onEvents = pathname?.startsWith("/events") ?? false;
  const onCommunity = (pathname?.startsWith("/community") || pathname?.startsWith("/publish")) ?? false;
  const onMore = open || MORE_PREFIXES.some((p) => pathname?.startsWith(p));
  const onProfile =
    (pathname?.startsWith("/dashboard") ||
      pathname?.startsWith("/sign-in") ||
      pathname?.startsWith("/sign-up") ||
      pathname?.startsWith("/onboarding") ||
      pathname?.startsWith("/welcome") ||
      pathname?.startsWith("/membership")) ??
    false;

  return (
    <>
      <div className="h-16 md:hidden" aria-hidden />

      {open && (
        <>
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 animate-[overlay-in_0.15s_ease_both] bg-black/60 md:hidden"
          />
          <div
            role="dialog"
            aria-label="More"
            className="fixed inset-x-0 bottom-16 z-50 animate-[sheet-up_0.2s_ease_both] rounded-t-2xl border-t border-border bg-surface p-5 pb-6 md:hidden"
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-border-strong" />
            <div className="grid grid-cols-2 gap-2.5">
              {MORE_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-lg border border-border-strong px-4 py-3.5 text-[15px] text-foreground hover:border-accent-dim"
                >
                  {l.label}
                </Link>
              ))}
            </div>
            {me && (
              <Link
                href="/publish"
                onClick={() => setOpen(false)}
                className="mt-2.5 block rounded-lg border border-accent-dim bg-accent/[0.06] px-4 py-3.5 text-center text-[15px] text-navy"
              >
                Write something
              </Link>
            )}
            {me?.is_admin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="mt-2.5 block rounded-lg border border-border-strong px-4 py-3.5 text-center text-[15px] text-muted"
              >
                Admin
              </Link>
            )}
          </div>
        </>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex items-stretch justify-around border-t border-[#ddd6c4] bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Primary"
      >
        <TabLink href="/" label="Home" active={onHome} icon={<HomeIcon />} />
        <TabLink href="/events" label="Events" active={onEvents} icon={<EventsIcon />} />
        <TabLink href="/community" label="Community" active={onCommunity} icon={<CommunityIcon />} />
        <TabButton label="More" active={onMore} icon={<MoreIcon />} onClick={() => setOpen((o) => !o)} />
        <TabLink
          href={me ? "/dashboard" : "/sign-in"}
          label={me ? "Profile" : "Sign In"}
          active={onProfile}
          icon={<ProfileIcon />}
          badge={unread > 0}
        />
      </nav>
    </>
  );
}

function TabLink({
  href,
  label,
  active,
  icon,
  badge,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
  badge?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] ${
        active ? "text-navy" : "text-faint"
      }`}
    >
      {icon}
      {badge && <span className="absolute right-[26%] top-1.5 h-2 w-2 rounded-full bg-warn" />}
      {label}
    </Link>
  );
}

function TabButton({
  label,
  active,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] ${
        active ? "text-navy" : "text-faint"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function HomeIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9h12v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EventsIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M4 10h16" strokeLinecap="round" />
      <path d="M8 3.5v3M16 3.5v3" strokeLinecap="round" />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6.5" cy="6.5" r="1.6" />
      <circle cx="17.5" cy="6.5" r="1.6" />
      <circle cx="6.5" cy="17.5" r="1.6" />
      <circle cx="17.5" cy="17.5" r="1.6" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="8.2" r="3.2" />
      <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" strokeLinecap="round" />
    </svg>
  );
}
