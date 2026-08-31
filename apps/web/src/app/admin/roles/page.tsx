"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, adminApi, type AdminRow } from "@/lib/api";

export default function AdminRolesPage() {
  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<AdminRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAdmins = useCallback(() => {
    adminApi.listAdmins().then(setAdmins);
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  async function search() {
    setError(null);
    setFound(undefined);
    const result = await adminApi.searchUser(email.trim());
    setFound(result);
  }

  async function toggle() {
    if (!found) return;
    setBusy(true);
    setError(null);
    try {
      if (found.is_admin) await adminApi.removeAdmin(found.user_id);
      else await adminApi.makeAdmin(found.user_id);
      setFound({ ...found, is_admin: !found.is_admin });
      loadAdmins();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update role.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-160">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">settings · people</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Roles</h1>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-[#e8e1d2] px-5 py-3.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          current admins
        </div>
        {admins?.map((a) => (
          <div key={a.user_id} className="flex items-center gap-3.5 border-b border-[#e8e1d2] px-5 py-3.5 last:border-0">
            <div className="grid h-8.5 w-8.5 flex-none place-items-center rounded-full border border-border-strong bg-[#f0ece0] font-mono text-[11px] text-muted">
              {a.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">{a.name}</div>
              <div className="mt-0.5 font-mono text-[10.5px] text-faint">{a.email}</div>
            </div>
            <span className="rounded-md border border-[#f0dfb8] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-warn">
              admin
            </span>
          </div>
        ))}
      </div>

      <div className="mt-7 rounded-xl border border-border bg-surface p-5.5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">grant or revoke access</div>
        <div className="mt-3.5 flex gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@students.mut.ac.ke"
            className="flex-1 rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
          />
          <button
            onClick={search}
            className="rounded-md border border-border-strong px-4 py-2.5 text-sm hover:border-accent-dim"
          >
            Search
          </button>
        </div>

        {found === null && <p className="mt-3.5 text-sm text-muted">No user with that email.</p>}
        {found && (
          <div className="mt-4.5 flex items-center gap-3.5 rounded-lg border border-border-strong p-4">
            <div className="min-w-0 flex-1">
              <div className="text-[15px]">{found.name}</div>
              <div className="mt-0.5 font-mono text-[10.5px] text-faint">{found.email}</div>
            </div>
            <button
              onClick={toggle}
              disabled={busy}
              className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                found.is_admin
                  ? "border border-[#f6d9d6] text-danger"
                  : "border-0 bg-accent text-[#1a2744]"
              }`}
            >
              {found.is_admin ? "Remove admin" : "Make admin"}
            </button>
          </div>
        )}
        {error && <p className="mt-3.5 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
