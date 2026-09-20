"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, adminApi, type MembershipApplication } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
import { experienceLevels, goalOptions } from "@/lib/data";

const FILTERS = [
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
];

// "inactive" is what the API calls status "none" — never paid, or payment abandoned.
const STATUS_OPTIONS = [
  { value: "active", label: "Paid / active" },
  { value: "expired", label: "Expired" },
  { value: "inactive", label: "Inactive" },
];

const STATUS_LABEL: Record<string, string> = { active: "active", expired: "expired", inactive: "inactive" };

function statusValue(membershipStatus: string) {
  if (membershipStatus === "active" || membershipStatus === "expired") return membershipStatus;
  return membershipStatus === "suspended" ? "suspended" : "inactive";
}

const EXPERIENCE_LABEL: Record<string, string> = Object.fromEntries(experienceLevels.map((l) => [l.value, l.label]));

export default function MembershipsPage() {
  const [filter, setFilter] = useState("active");
  const [query, setQuery] = useState("");
  const [apps, setApps] = useState<MembershipApplication[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  const load = useCallback(() => {
    adminApi.memberships(filter, query).then(setApps);
  }, [filter, query]);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      adminApi.memberships(filter, query).then((result) => {
        if (active) setApps(result);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [filter, query]);

  const stats = useMemo(() => {
    if (!apps || apps.length === 0) return null;

    const experienceCounts = new Map<string, number>();
    let experienceUnset = 0;
    for (const a of apps) {
      if (a.experience_level) experienceCounts.set(a.experience_level, (experienceCounts.get(a.experience_level) ?? 0) + 1);
      else experienceUnset += 1;
    }

    const goalCounts = new Map<string, number>();
    for (const a of apps) {
      for (const g of a.goals) goalCounts.set(g, (goalCounts.get(g) ?? 0) + 1);
    }
    const topGoals = goalOptions
      .map((g) => ({ label: g, count: goalCounts.get(g) ?? 0 }))
      .filter((g) => g.count > 0)
      .sort((x, y) => y.count - x.count);

    return {
      total: apps.length,
      experience: experienceLevels.map((l) => ({ label: l.label, count: experienceCounts.get(l.value) ?? 0 })),
      experienceUnset,
      topGoals,
    };
  }, [apps]);

  async function changeStatus(a: MembershipApplication, next: string) {
    if (next === statusValue(a.membership_status)) return;
    const nextLabel = STATUS_OPTIONS.find((o) => o.value === next)?.label ?? next;
    const ok = await confirm({
      title: `Mark ${a.name} as ${nextLabel.toLowerCase()}?`,
      message:
        next === "active"
          ? "Use this when they've paid in cash or already have an older account. They'll get a fresh 12-month membership and a notification."
          : next === "expired"
            ? "They'll lose member access until they renew."
            : "This resets them to a non-member who hasn't paid.",
      confirmLabel: "Change status",
      danger: next !== "active",
    });
    if (!ok) return;
    setError(null);
    setBusyId(a.user_id);
    try {
      await adminApi.setMembershipStatus(a.user_id, next as "active" | "expired" | "inactive", "Changed manually from the members page");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update status.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAdmin(a: MembershipApplication) {
    const ok = await confirm(
      a.is_admin
        ? {
            title: "Remove admin access?",
            message: `${a.name} will lose access to the admin panel. They'll keep their membership.`,
          }
        : {
            title: "Make admin?",
            message: `${a.name} will get full access to the admin panel — members, payments, content, everything. They'll get an email letting them know.`,
          },
    );
    if (!ok) return;
    setError(null);
    setBusyId(a.user_id);
    try {
      if (a.is_admin) await adminApi.removeAdmin(a.user_id);
      else await adminApi.makeAdmin(a.user_id);
      setApps((prev) => prev?.map((row) => (row.user_id === a.user_id ? { ...row, is_admin: !row.is_admin } : row)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update role.");
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">membership</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Members</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.08em] ${
              filter === f.value ? "border-[#f0dfb8] bg-warn/[0.07] text-warn" : "border-border-strong text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, email or reg number"
        aria-label="Search members"
        className="mt-4 w-full max-w-md rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent-dim"
      />

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {stats && (
        <div className="mt-5.5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[11px] border border-border bg-surface p-4.5">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
              experience · {stats.total} member{stats.total === 1 ? "" : "s"}
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {stats.experience.map((e) => (
                <div key={e.label} className="flex items-center justify-between gap-3 text-[13.5px]">
                  <span className="text-muted">{e.label}</span>
                  <span className="font-mono text-[12px] text-foreground">{e.count}</span>
                </div>
              ))}
              {stats.experienceUnset > 0 && (
                <div className="flex items-center justify-between gap-3 text-[13.5px]">
                  <span className="text-faint">Not set</span>
                  <span className="font-mono text-[12px] text-faint">{stats.experienceUnset}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[11px] border border-border bg-surface p-4.5">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">goals</div>
            <div className="mt-3 flex flex-col gap-1.5">
              {stats.topGoals.length === 0 && <p className="text-[13.5px] text-faint">No goals set yet.</p>}
              {stats.topGoals.map((g) => (
                <div key={g.label} className="flex items-center justify-between gap-3 text-[13.5px]">
                  <span className="text-muted">{g.label}</span>
                  <span className="font-mono text-[12px] text-foreground">{g.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5.5 overflow-hidden rounded-[11px] border border-border bg-surface">
        <div className="grid grid-cols-[1.5fr_0.9fr_0.8fr_0.9fr] gap-3.5 border-b border-[#ddd6c4] bg-[#f5f0e3] px-4.5 py-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
          <span>member</span>
          <span>payment</span>
          <span>status</span>
          <span>role</span>
        </div>

        {apps?.length === 0 && <div className="px-4.5 py-8 text-center text-sm text-muted">{query.trim() ? "No members match that search." : "No members here."}</div>}

        {apps?.map((a) => (
          <div key={a.user_id} className="border-b border-[#e8e1d2] px-4.5 py-4 last:border-0">
            <div className="grid grid-cols-[1.5fr_0.9fr_0.8fr_0.9fr] items-center gap-3.5">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-medium">{a.name}</div>
                <div className="mt-1 truncate font-mono text-[10.5px] text-faint">
                  {a.course ?? a.email}
                  {a.year_of_study ? ` · year ${a.year_of_study}` : ""}
                </div>
                {(a.experience_level || a.goals.length > 0) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {a.experience_level && (
                      <span className="rounded-md border border-border-strong px-1.5 py-0.5 text-[10px] text-muted">
                        {EXPERIENCE_LABEL[a.experience_level] ?? a.experience_level}
                      </span>
                    )}
                    {a.goals.map((g) => (
                      <span key={g} className="rounded-md border border-[#e8e1d2] bg-[#f5f0e3] px-1.5 py-0.5 text-[10px] text-[#8f8368]">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div
                className={`font-mono text-[11.5px] ${
                  a.payment_status === "completed" ? "text-navy" : "text-warn"
                }`}
              >
                {a.payment_status ?? "none"}
                {a.payment_receipt ? ` · ${a.payment_receipt}` : ""}
              </div>
              <div>
                <select
                  value={statusValue(a.membership_status)}
                  onChange={(e) => changeStatus(a, e.target.value)}
                  disabled={busyId === a.user_id}
                  aria-label={`Membership status for ${a.name}`}
                  className={`max-w-full rounded-md border bg-surface px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] disabled:opacity-50 ${
                    a.membership_status === "active"
                      ? "border-accent-dim text-navy"
                      : a.membership_status === "expired" || a.membership_status === "suspended"
                        ? "border-[#e2b8b8] text-danger"
                        : "border-border-strong text-muted"
                  }`}
                >
                  {a.membership_status === "suspended" && <option value="suspended" disabled>suspended</option>}
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {STATUS_LABEL[o.value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button
                  onClick={() => toggleAdmin(a)}
                  disabled={busyId === a.user_id}
                  className={`justify-self-start rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] disabled:opacity-50 ${
                    a.is_admin ? "border-[#f0dfb8] text-warn" : "border-border-strong text-muted hover:border-accent-dim"
                  }`}
                >
                  {a.is_admin ? "admin ✓" : "make admin"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
