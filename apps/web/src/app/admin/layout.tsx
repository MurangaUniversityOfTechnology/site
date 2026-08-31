"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/lib/useMe";

const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/memberships", label: "Members" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/github", label: "GitHub" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/roles", label: "Roles" },
  { href: "/admin/members/add", label: "Add member" },
  { href: "/admin/members/import", label: "Import members" },
  { href: "/admin/audit", label: "Audit log" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, loading } = useMe();

  useEffect(() => {
    if (loading) return;
    if (!me) router.push("/sign-in");
    else if (!me.is_admin) router.push("/dashboard");
  }, [loading, me, router]);

  if (loading || !me || !me.is_admin) return null;

  return (
    <div>
      <header className="flex h-16 items-center gap-5 border-b border-navy-2 bg-navy px-4.5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/images/logo.png" alt="MUT Tech Community" width={30} height={30} className="h-7.5 w-7.5" />
          <span className="whitespace-nowrap text-[14.5px] font-semibold tracking-tight text-white">MUT Tech</span>
        </Link>
        <span className="rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
          admin
        </span>
      </header>

      <div className="grid min-h-[calc(100vh-64px)] grid-cols-1 md:grid-cols-[210px_1fr]">
        <nav className="flex flex-row gap-0.5 overflow-x-auto border-b border-border bg-surface-raised p-2.5 md:flex-col md:border-b-0 md:border-r md:p-4">
          {adminNav.map((n) => {
            const active = n.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-md px-3 py-2.5 text-sm ${
                  active ? "bg-navy/8 text-navy font-medium" : "text-muted hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <main className="min-w-0 bg-background px-5 py-8 sm:px-9 sm:py-11">{children}</main>
      </div>
    </div>
  );
}
