"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { useMe } from "@/lib/useMe";
import { useSignOut } from "@/lib/useSignOut";

/** Desktop-only account chip + dropdown, shared by the public top bar and
 * the admin header — same menu, same place, no matter which one you're on. */
export function AccountMenu() {
  const { me } = useMe();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  if (!me) return null;

  return (
    <div ref={ref} className="relative flex-none">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full border border-white/16 bg-white/[0.06] py-1 pl-1 pr-3 text-[12.5px] text-white hover:border-accent"
      >
        <Avatar
          photoUrl={me.photo_url}
          name={me.email}
          className="h-6 w-6"
          fallbackClassName="bg-accent text-navy-3"
          textClassName="text-[11px] font-bold"
        />
        <span className="hidden max-w-32 truncate sm:inline">{me.email}</span>
        <span className="text-white/50">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-52 rounded-xl border border-border bg-surface p-1.5 text-left shadow-[0_12px_32px_rgba(15,26,48,0.18)]">
          <MenuLink href="/dashboard" onClick={() => setOpen(false)}>
            Dashboard
          </MenuLink>
          <MenuLink href="/settings" onClick={() => setOpen(false)}>
            Settings
          </MenuLink>
          {(me.is_admin || me.is_staff) && (
            <MenuLink href="/admin" onClick={() => setOpen(false)}>
              Admin
            </MenuLink>
          )}
          <div className="my-1.5 h-px bg-border" />
          <button
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[13.5px] text-danger hover:bg-surface-raised"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-lg px-3 py-2 text-[13.5px] text-foreground hover:bg-surface-raised"
    >
      {children}
    </Link>
  );
}
