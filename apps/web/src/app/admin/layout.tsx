"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/lib/useMe";

const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/memberships", label: "Members" },
  { href: "/admin/payments", label: "Payments" },
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
      <header className="flex h-16 items-center gap-5 border-b border-[#161c1e] bg-[#0a0d0e] px-4.5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="grid h-6 w-6 place-items-center rounded-[5px] border-[1.5px] border-warn font-mono text-[11px] font-bold text-warn">
            M
          </div>
          <span className="whitespace-nowrap text-[14.5px] font-semibold tracking-tight">MUT Tech</span>
        </Link>
        <span className="rounded-md border border-[#3a3226] bg-warn/[0.06] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-warn">
          admin
        </span>
      </header>

      <div className="grid min-h-[calc(100vh-64px)] grid-cols-1 md:grid-cols-[210px_1fr]">
        <nav className="flex flex-row gap-0.5 overflow-x-auto border-b border-[#161c1e] bg-[#090c0d] p-2.5 md:flex-col md:border-b-0 md:border-r md:p-4">
          {adminNav.map((n) => {
            const active = n.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-md px-3 py-2.5 text-sm ${
                  active ? "bg-white/5 text-warn" : "text-muted hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <main className="min-w-0 px-5 py-8 sm:px-9 sm:py-11">{children}</main>
      </div>
    </div>
  );
}
