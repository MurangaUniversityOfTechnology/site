"use client";

import { useEffect, useState } from "react";
import { ApiError, adminApi, type AdminJoinRequestRow, type AdminProjectRow } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";

export default function AdminProjectsPage() {
  const [rows, setRows] = useState<AdminJoinRequestRow[] | null>(null);
  const [view, setView] = useState<"active" | "archived">("active");
  const [projects, setProjects] = useState<AdminProjectRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [repoName, setRepoName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const confirm = useConfirm();

  function loadProjects() {
    adminApi.listTrackedProjects(view === "archived").then(setProjects);
  }

  useEffect(() => {
    let active = true;
    adminApi.joinRequests().then((result) => {
      if (active) setRows(result);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    adminApi.listTrackedProjects(view === "archived").then((result) => {
      if (active) setProjects(result);
    });
    return () => {
      active = false;
    };
  }, [view]);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      await (action === "approve" ? adminApi.approveJoinRequest : adminApi.rejectJoinRequest)(id);
      setRows((r) => r?.filter((x) => x.id !== id) ?? null);
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      await adminApi.syncProjects();
      loadProjects();
    } finally {
      setSyncing(false);
    }
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    try {
      await adminApi.addProject({ repo_name: repoName.trim(), display_name: displayName.trim() || null });
      setRepoName("");
      setDisplayName("");
      loadProjects();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : "Couldn't add project.");
    } finally {
      setAdding(false);
    }
  }

  async function removeProject(slug: string, name: string) {
    const ok = await confirm({
      title: "Stop tracking project?",
      message: `"${name}" will be removed from the tracked projects list. The GitHub repo itself is untouched.`,
    });
    if (!ok) return;
    setBusy(slug);
    try {
      await adminApi.removeProject(slug);
      setProjects((p) => p?.filter((x) => x.slug !== slug) ?? null);
    } finally {
      setBusy(null);
    }
  }

  async function completeProject(slug: string) {
    setBusy(slug);
    setProjectError(null);
    try {
      const updated = await adminApi.completeProject(slug);
      setProjects((p) => p?.map((x) => (x.slug === slug ? updated : x)) ?? null);
    } catch (err) {
      setProjectError(err instanceof ApiError ? err.message : "Couldn't mark project completed.");
    } finally {
      setBusy(null);
    }
  }

  async function activateProject(slug: string) {
    setBusy(slug);
    setProjectError(null);
    try {
      const updated = await adminApi.activateProject(slug);
      setProjects((p) => p?.map((x) => (x.slug === slug ? updated : x)) ?? null);
    } catch (err) {
      setProjectError(err instanceof ApiError ? err.message : "Couldn't mark project active.");
    } finally {
      setBusy(null);
    }
  }

  async function archiveProject(slug: string, name: string) {
    const ok = await confirm({
      title: "Archive project?",
      message: `"${name}" will drop out of the tracked-projects and public lists. It can be unarchived later.`,
    });
    if (!ok) return;
    setBusy(slug);
    setProjectError(null);
    try {
      await adminApi.archiveProject(slug);
      setProjects((p) => p?.filter((x) => x.slug !== slug) ?? null);
    } catch (err) {
      setProjectError(err instanceof ApiError ? err.message : "Couldn't archive project.");
    } finally {
      setBusy(null);
    }
  }

  async function unarchiveProject(slug: string) {
    setBusy(slug);
    setProjectError(null);
    try {
      await adminApi.unarchiveProject(slug);
      setProjects((p) => p?.filter((x) => x.slug !== slug) ?? null);
    } catch (err) {
      setProjectError(err instanceof ApiError ? err.message : "Couldn't unarchive project.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-190">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">projects</div>
          <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Tracked projects</h1>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="rounded-md border border-border-strong px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted hover:border-accent-dim disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync from GitHub"}
        </button>
      </div>

      <form onSubmit={addProject} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-5">
        <label className="block">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">GitHub repo name</div>
          <input
            required
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="my-repo"
            className="mt-2 rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Display name (optional)</div>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="defaults to repo name"
            className="mt-2 rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={adding}
          className="rounded-md bg-accent px-4.5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744] hover:opacity-90 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Track project"}
        </button>
        {addError && <p className="w-full text-sm text-danger">{addError}</p>}
      </form>

      <div className="mt-6 flex gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em]">
        <button
          onClick={() => setView("active")}
          className={`rounded-md px-3.5 py-2 ${view === "active" ? "bg-accent text-[#1a2744]" : "border border-border-strong text-muted"}`}
        >
          Active
        </button>
        <button
          onClick={() => setView("archived")}
          className={`rounded-md px-3.5 py-2 ${view === "archived" ? "bg-accent text-[#1a2744]" : "border border-border-strong text-muted"}`}
        >
          Archived
        </button>
      </div>

      {projectError && <p className="mt-3.5 text-sm text-danger">{projectError}</p>}

      <div className="mt-4 overflow-hidden rounded-[11px] border border-border bg-surface">
        {projects?.length === 0 && (
          <div className="px-4.5 py-8 text-center text-sm text-muted">
            {view === "archived" ? "No archived projects." : "No projects tracked yet."}
          </div>
        )}
        {projects?.map((p) => (
          <div key={p.slug} className="flex flex-wrap items-center gap-4 border-b border-[#e8e1d2] px-4.5 py-4 last:border-0">
            <div className="min-w-45 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-medium">{p.name}</span>
                {p.completed_at && (
                  <span className="rounded border border-border-strong px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted">
                    completed
                  </span>
                )}
              </div>
              <div className="mt-1 font-mono text-[10.5px] text-faint">{p.repo_name}</div>
            </div>
            <span className="font-mono text-[10.5px] text-muted">{p.language ?? "—"}</span>
            <span className="font-mono text-[10.5px] text-muted">{p.member_count} members</span>
            <div className="flex flex-wrap gap-2">
              {view === "active" && (
                <>
                  {p.completed_at ? (
                    <button
                      onClick={() => activateProject(p.slug)}
                      disabled={busy === p.slug}
                      className="rounded-md border border-border-strong px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted disabled:opacity-50"
                    >
                      undo
                    </button>
                  ) : (
                    <button
                      onClick={() => completeProject(p.slug)}
                      disabled={busy === p.slug}
                      className="rounded-md border border-accent-dim px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-navy disabled:opacity-50"
                    >
                      complete
                    </button>
                  )}
                  {p.completed_at && (
                    <button
                      onClick={() => archiveProject(p.slug, p.name)}
                      disabled={busy === p.slug}
                      className="rounded-md border border-border-strong px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted disabled:opacity-50"
                    >
                      archive
                    </button>
                  )}
                  <button
                    onClick={() => removeProject(p.slug, p.name)}
                    disabled={busy === p.slug}
                    className="rounded-md border border-[#f6d9d6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-danger disabled:opacity-50"
                  >
                    remove
                  </button>
                </>
              )}
              {view === "archived" && (
                <button
                  onClick={() => unarchiveProject(p.slug)}
                  disabled={busy === p.slug}
                  className="rounded-md bg-accent px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#1a2744] disabled:opacity-50"
                >
                  unarchive
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-9 text-[clamp(20px,2.6vw,28px)] tracking-[-0.03em]">Join requests</h2>

      <div className="mt-6 flex flex-col gap-3.5">
        {rows?.length === 0 && (
          <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center text-sm text-muted">
            Nothing waiting on you.
          </div>
        )}
        {rows?.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-navy">{r.project_name}</span>
              <span className="text-[15px] font-semibold">{r.user_name}</span>
              <span className="font-mono text-[10.5px] text-faint">{r.user_email}</span>
            </div>
            {r.contribution_areas.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {r.contribution_areas.map((a) => (
                  <span key={a} className="rounded border border-border-strong px-2 py-0.5 font-mono text-[10px] text-muted">
                    {a}
                  </span>
                ))}
              </div>
            )}
            {r.message && <p className="mt-3.5 text-[14.5px] leading-[1.55] text-muted">{r.message}</p>}
            <div className="mt-4.5 flex flex-wrap gap-2">
              <button
                onClick={() => act(r.id, "approve")}
                disabled={busy === r.id}
                className="rounded-md border border-accent-dim px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-navy disabled:opacity-50"
              >
                approve
              </button>
              <button
                onClick={() => act(r.id, "reject")}
                disabled={busy === r.id}
                className="rounded-md border border-[#f6d9d6] px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-danger disabled:opacity-50"
              >
                reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
