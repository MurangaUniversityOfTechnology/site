"use client";

import { useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { CourseSidebar } from "@/components/CourseSidebar";

export default function LearnLayout({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="lg:flex">
      <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-2.5 lg:hidden">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">course menu</span>
        <button
          onClick={() => setDrawerOpen(true)}
          className="rounded-md border border-border-strong px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted"
        >
          ☰ menu
        </button>
      </div>

      <aside className="hidden lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-64px)] lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-border lg:bg-surface">
        <CourseSidebar slug={slug} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[80vw] overflow-y-auto bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">course menu</span>
              <button onClick={() => setDrawerOpen(false)} className="text-muted">
                ✕
              </button>
            </div>
            <CourseSidebar slug={slug} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
