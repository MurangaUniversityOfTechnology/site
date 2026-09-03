"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/lib/useMe";
import { useSignOut } from "@/lib/useSignOut";
import { AccountMenu } from "@/components/AccountMenu";

type NavGroup = { section: string | null; items: { href: string; label: string }[] };

const adminNav: NavGroup[] = [
  { section: null, items: [{ href: "/admin", label: "Overview" }] },
  {
    section: "People",
    items: [
      { href: "/admin/memberships", label: "Members" },
      { href: "/admin/roles", label: "Roles" },
      { href: "/admin/members/add", label: "Add member" },
      { href: "/admin/members/import", label: "Import members" },
    ],
  },
  {
    section: "Programs",
    items: [
      { href: "/admin/events", label: "Events" },
      { href: "/admin/courses", label: "Courses" },
      { href: "/admin/arms", label: "Arms" },
      { href: "/admin/projects", label: "Projects" },
      { href: "/admin/github", label: "GitHub" },
      { href: "/admin/content", label: "Content" },
    ],
  },
  {
    section: "Finance",
    items: [
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/donations", label: "Donations" },
    ],
  },
  { section: "System", items: [{ href: "/admin/audit", label: "Audit log" }] },
];

const COLLAPSED_STORAGE_KEY = "admin-nav-collapsed";

function isActive(pathname: string | null, href: string) {
  return href === "/admin" ? pathname === "/admin" : (pathname?.startsWith(href) ?? false);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, loading } = useMe();
  const signOut = useSignOut();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    // Safe to read synchronously — this layout renders null until auth
    // resolves (see the loading/me guard below), so there's never a
    // server-rendered version of the nav for this to mismatch against.
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    if (loading) return;
    if (!me) router.push("/sign-in");
    else if (!me.is_admin) router.push("/dashboard");
  }, [loading, me, router]);

  function toggleGroup(section: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore — collapse state just won't persist
      }
      return next;
    });
  }

  if (loading || !me || !me.is_admin) return null;

  return (
    <div>
      <header className="flex h-16 items-center gap-3.5 border-b border-navy-2 bg-navy px-4.5 sm:px-8">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open admin menu"
          className="grid h-9 w-9 flex-none place-items-center rounded-md text-white/80 hover:bg-white/10 md:hidden"
        >
          <HamburgerIcon />
        </button>
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/images/logo.png" alt="MUT Tech Community" width={30} height={30} className="h-7.5 w-7.5" />
          <span className="whitespace-nowrap text-[14.5px] font-semibold tracking-tight text-white">MUT Tech</span>
        </Link>
        <span className="rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
          admin
        </span>
        <div className="ml-auto">
          <AccountMenu />
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-64px)] grid-cols-1 md:grid-cols-[210px_1fr]">
        <nav className="hidden md:flex md:flex-col md:gap-0.5 md:border-r md:border-border md:bg-surface-raised md:p-4">
          <AdminNavList pathname={pathname} collapsed={collapsed} onToggle={toggleGroup} variant="sidebar" />
        </nav>
        <main className="min-w-0 bg-background px-5 py-8 sm:px-9 sm:py-11">{children}</main>
      </div>

      {drawerOpen && (
        <>
          <button
            aria-label="Close admin menu"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-40 bg-navy-3/45 md:hidden"
          />
          <div
            role="dialog"
            aria-label="Admin navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-[78%] max-w-72 flex-col bg-surface shadow-[8px_0_24px_rgba(15,26,48,0.2)] md:hidden"
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
              <Image src="/images/logo.png" alt="MUT Tech Community" width={26} height={26} className="h-6.5 w-6.5" />
              <span className="text-[13.5px] font-semibold tracking-tight">MUT Tech</span>
              <span className="rounded-md border border-accent-dim/30 bg-accent/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-accent-dim">
                admin
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5">
              <AdminNavList pathname={pathname} collapsed={collapsed} onToggle={toggleGroup} variant="drawer" />
            </div>
            <div className="border-t border-border p-2.5">
              <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] text-muted hover:bg-surface-raised">
                ← Back to site
              </Link>
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  signOut();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[14px] text-danger hover:bg-surface-raised"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AdminNavList({
  pathname,
  collapsed,
  onToggle,
  variant,
}: {
  pathname: string | null;
  collapsed: Record<string, boolean>;
  onToggle: (section: string) => void;
  variant: "sidebar" | "drawer";
}) {
  const linkClass =
    variant === "sidebar"
      ? "block whitespace-nowrap rounded-md px-3 py-2.5 text-sm"
      : "block rounded-lg px-3 py-2.5 text-[14px]";
  const linkActive = "bg-navy/8 font-medium text-navy";
  const linkInactive = variant === "sidebar" ? "text-muted hover:text-foreground" : "text-foreground hover:bg-surface-raised";

  return (
    <>
      {adminNav.map((group) => {
        const groupHasActiveItem = group.items.some((n) => isActive(pathname, n.href));
        const expanded = !group.section || groupHasActiveItem || !collapsed[group.section];
        return (
          <div key={group.section ?? "root"}>
            {group.section && (
              <button
                type="button"
                onClick={() => onToggle(group.section!)}
                aria-expanded={expanded}
                className="mt-3.5 flex w-full items-center justify-between rounded-md px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint first:mt-0 hover:text-muted"
              >
                {group.section}
                <ChevronIcon expanded={expanded} />
              </button>
            )}
            {expanded &&
              group.items.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`${linkClass} ${isActive(pathname, n.href) ? linkActive : linkInactive}`}
                >
                  {n.label}
                </Link>
              ))}
          </div>
        );
      })}
    </>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      className={`flex-none transition-transform duration-150 ${expanded ? "" : "-rotate-90"}`}
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}
