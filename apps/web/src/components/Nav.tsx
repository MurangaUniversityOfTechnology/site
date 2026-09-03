"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/lib/useMe";
import { useUnreadCount } from "@/lib/useUnreadCount";
import { BellIcon } from "@/components/icons";
import { AccountMenu } from "@/components/AccountMenu";

const links = [
  { href: "/projects", label: "Projects" },
  { href: "/events", label: "Events" },
  { href: "/challenges", label: "Challenges" },
  { href: "/courses", label: "Courses" },
  { href: "/learn", label: "Learn" },
  { href: "/community", label: "Community" },
  { href: "/members", label: "People" },
  { href: "/donate", label: "Donate" },
];

export function Nav() {
  const { me, loading } = useMe();
  const pathname = usePathname();
  const unread = useUnreadCount(me, pathname);

  if (pathname?.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-5 border-b border-navy-2 bg-navy px-4 text-white/90 backdrop-blur-sm sm:px-6">
      <Link href="/" className="flex flex-none items-center gap-2.5">
        <Image src="/images/logo.png" alt="MUT Tech Community" width={30} height={30} className="h-7.5 w-7.5" priority />
        <span className="whitespace-nowrap text-[14.5px] font-semibold tracking-tight text-white">MUT Tech</span>
      </Link>

      <nav className="hidden min-w-0 flex-1 gap-5 overflow-x-auto text-[13.5px] text-white/60 md:flex">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="whitespace-nowrap text-white/60 hover:text-white">
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex flex-none items-center gap-3.5">
        {loading ? null : me ? (
          <>
            <Link
              href="/notifications"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
              className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/10"
            >
              <BellIcon className="h-4.5 w-4.5 text-white/70" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
              )}
            </Link>
            <AccountMenu />
          </>
        ) : (
          <>
            <Link href="/sign-in" className="whitespace-nowrap text-[13.5px] text-white/60 hover:text-white">
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-[13.5px] font-semibold text-navy hover:opacity-90"
            >
              Join Club
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
