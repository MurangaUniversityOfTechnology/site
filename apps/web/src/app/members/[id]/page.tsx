"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CourseBadge } from "@/components/CourseBadge";
import { ApiError, memberApi, type MemberProfile } from "@/lib/api";

const EXPERIENCE_LABEL: Record<string, string> = {
  starting: "Just getting started",
  some_projects: "Built a few projects",
  independent: "Builds independently",
  advanced: "Advanced / experienced",
};

export default function MemberProfilePage() {
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<MemberProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    memberApi
      .get(params.id)
      .then((result) => {
        if (active) setProfile(result);
      })
      .catch((err) => {
        if (!active) return;
        setProfile(null);
        setError(err instanceof ApiError ? err.message : "Couldn't load this profile.");
      });
    return () => {
      active = false;
    };
  }, [params.id]);

  if (profile === undefined) return null;

  if (!profile) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em]">Profile unavailable</h1>
          <p className="mt-3 text-muted">{error ?? "This member's profile can't be viewed."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-160 px-5 py-14 sm:px-8">
      <div className="rounded-2xl border border-border bg-surface p-7 text-center sm:p-9">
        <div className="mx-auto grid h-19 w-19 place-items-center rounded-full border border-[#e8d9ad] bg-[linear-gradient(150deg,#fbf3df,#f5e6bf)] font-mono text-2xl text-navy">
          {profile.display_name[0]?.toUpperCase()}
        </div>
        <div className="mt-4 text-xl font-semibold">{profile.display_name}</div>
        {profile.experience_level && (
          <div className="mt-1.5 font-mono text-[11px] text-faint">{EXPERIENCE_LABEL[profile.experience_level]}</div>
        )}

        {profile.interests.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {profile.interests.map((i) => (
              <span key={i} className="rounded-full border border-border-strong px-3 py-1 font-mono text-[11px] text-muted">
                {i}
              </span>
            ))}
          </div>
        )}

        {(profile.github_url || profile.linkedin_url) && (
          <div className="mt-5 flex justify-center gap-3">
            {profile.github_url && (
              <a
                href={`https://${profile.github_url.replace(/^https?:\/\//, "")}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-border-strong px-4 py-2 text-sm hover:border-accent-dim"
              >
                GitHub
              </a>
            )}
            {profile.linkedin_url && (
              <a
                href={`https://${profile.linkedin_url.replace(/^https?:\/\//, "")}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-border-strong px-4 py-2 text-sm hover:border-accent-dim"
              >
                LinkedIn
              </a>
            )}
          </div>
        )}
      </div>

      {profile.bio && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-6">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">about</div>
          <p className="mt-3 text-[15.5px] leading-[1.6] text-[#33302b]">{profile.bio}</p>
        </div>
      )}

      {profile.completed_courses.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-6">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">badges earned</div>
          <div className="mt-4 flex flex-wrap gap-4">
            {profile.completed_courses.map((c) => (
              <Link key={c.slug} href={`/courses/${c.slug}`} className="flex flex-col items-center gap-2 text-center">
                <CourseBadge slug={c.slug} title={c.title} size="lg" />
                <span className="max-w-20 text-[11px] leading-tight text-muted">{c.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {profile.goals.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-6">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">here to</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.goals.map((g) => (
              <span key={g} className="rounded-md border border-border-strong px-3 py-1.5 text-[13.5px] text-muted">
                {g}
              </span>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
