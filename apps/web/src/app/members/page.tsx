"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { memberApi, type MemberSummary } from "@/lib/api";

const EXPERIENCE_LABEL: Record<string, string> = {
  starting: "just getting started",
  some_projects: "a few projects in",
  independent: "builds independently",
  advanced: "advanced",
};

export default function MembersPage() {
  const [members, setMembers] = useState<MemberSummary[] | null>(null);

  useEffect(() => {
    memberApi.directory().then(setMembers);
  }, []);

  return (
    <main className="px-5 py-12 sm:px-10 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">community</div>
      <h1 className="mt-3.5 text-[clamp(30px,5vw,54px)] leading-none tracking-[-0.04em]">MEMBERS</h1>
      <p className="mt-4 max-w-[480px] text-[16.5px] leading-[1.55] text-[#7a7060]">
        Builders in the club, with profiles set to public.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members?.map((m) => (
          <Link
            key={m.user_id}
            href={`/members/${m.user_id}`}
            className="flex items-center gap-3.5 rounded-xl border border-border bg-surface p-5 hover:border-accent-dim"
          >
            <Avatar photoUrl={m.photo_url} name={m.display_name} className="h-11 w-11" />
            <div className="min-w-0">
              <div className="truncate text-[15.5px] font-medium">{m.display_name}</div>
              <div className="mt-1 truncate font-mono text-[10.5px] text-faint">
                {m.experience_level ? EXPERIENCE_LABEL[m.experience_level] : m.interests.slice(0, 2).join(" · ") || "member"}
              </div>
            </div>
          </Link>
        ))}
        {members?.length === 0 && <p className="text-sm text-muted">No public profiles yet.</p>}
      </div>
    </main>
  );
}
