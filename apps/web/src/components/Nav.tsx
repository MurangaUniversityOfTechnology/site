"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/lib/useMe";
import { useUnreadCount } from "@/lib/useUnreadCount";

const links = [
  { href: "/projects", label: "Projects" },
  { href: "/events", label: "Events" },
  { href: "/challenges", label: "Challenges" },
  { href: "/learn", label: "Learn" },
  { href: "/community", label: "Community" },
  { href: "/members", label: "People" },
];

export function Nav() {
  const { me, loading } = useMe();
  const pathname = usePathname();
  const unread = useUnreadCount(me, pathname);

  if (pathname?.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-5 border-b border-[#161c1e] bg-background/95 px-4 backdrop-blur-sm sm:px-6">
      <Link href="/" className="flex flex-none items-center gap-2.5">
        <div className="grid h-6 w-6 place-items-center rounded-[5px] border-[1.5px] border-accent font-mono text-[11px] font-bold text-accent">
          M
        </div>
        <span className="whitespace-nowrap text-[14.5px] font-semibold tracking-tight">MUT Tech</span>
      </Link>

      <nav className="hidden min-w-0 flex-1 gap-5 overflow-x-auto text-[13.5px] text-muted md:flex">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="whitespace-nowrap text-muted hover:text-foreground">
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex flex-none items-center gap-3.5">
        {loading ? null : me ? (
          <>
            <Link href="/notifications" className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/5">
              <span className="relative block h-3.5 w-3.5 rounded-t-[3px] border-[1.4px] border-muted" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warn" />
              )}
            </Link>
            <Link
              href="/dashboard"
              className="whitespace-nowrap rounded-md border border-border-strong px-3.5 py-2 text-[13.5px] text-foreground hover:border-accent-dim"
            >
              Dashboard
            </Link>
          </>
        ) : (
          <>
            <Link href="/sign-in" className="whitespace-nowrap text-[13.5px] text-muted hover:text-foreground">
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-[13.5px] font-semibold text-[#04140b] hover:opacity-90"
            >
              Join Club
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
