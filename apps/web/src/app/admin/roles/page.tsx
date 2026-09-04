"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, adminApi, type AdminRow, type Tag } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
import { useMe } from "@/lib/useMe";

type Role = "member" | "staff" | "admin";

function roleOf(row: AdminRow): Role {
  if (row.is_admin) return "admin";
  if (row.is_staff) return "staff";
  return "member";
}

export default function AdminRolesPage() {
  const { me } = useMe();
  const isAdmin = me?.is_admin ?? false;

  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [staff, setStaff] = useState<AdminRow[] | null>(null);

  const [tags, setTags] = useState<Tag[] | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pickedTagId, setPickedTagId] = useState("");
  const confirm = useConfirm();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<AdminRow | undefined>(undefined);
  const [pendingRole, setPendingRole] = useState<Role>("member");
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);

  const loadAdmins = useCallback(() => {
    adminApi.listAdmins().then(setAdmins);
  }, []);

  const loadTags = useCallback(() => {
    adminApi.listTags().then(setTags);
  }, []);

  const loadStaff = useCallback(() => {
    adminApi.listStaff().then(setStaff);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadAdmins();
      loadTags();
    }
    loadStaff();
  }, [isAdmin, loadAdmins, loadTags, loadStaff]);

  useEffect(() => {
    const q = query.trim();
    if (!q || found) return;
    const timeout = setTimeout(() => {
      adminApi
        .searchUsers(q)
        .then(setResults)
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, found]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim()) setSearching(true);
  }

  function pick(row: AdminRow) {
    setFound(row);
    setPendingRole(roleOf(row));
    setResults([]);
    setQuery("");
    setRoleError(null);
  }

  function clearSelection() {
    setFound(undefined);
    setRoleError(null);
  }

  async function refreshFound() {
    if (!found) return;
    const matches = await adminApi.searchUsers(found.email);
    setFound(matches.find((m) => m.user_id === found.user_id) ?? found);
  }

  async function saveRole() {
    if (!found) return;
    const current = roleOf(found);
    if (pendingRole === current) return;

    if (current === "admin" || pendingRole === "admin") {
      const ok = await confirm(
        pendingRole === "admin"
          ? {
              title: "Make admin?",
              message: `${found.name} will get full access to the admin panel — members, payments, content, everything. They'll get an email letting them know.`,
            }
          : {
              title: "Remove admin access?",
              message: `${found.name} will lose access to the admin panel. They'll keep their membership.`,
            },
      );
      if (!ok) return;
    } else if (current === "staff" && pendingRole === "member") {
      const ok = await confirm({
        title: "Remove staff access?",
        message: `${found.name} will lose access to Forms, Courses, and Events management.`,
      });
      if (!ok) return;
    }

    setRoleBusy(true);
    setRoleError(null);
    try {
      if (current === "admin" && pendingRole !== "admin") await adminApi.removeAdmin(found.user_id);
      if (current === "staff" && pendingRole === "member") await adminApi.removeStaff(found.user_id);
      if (pendingRole === "staff" && current !== "staff") await adminApi.makeStaff(found.user_id);
      if (pendingRole === "admin" && current !== "admin") {
        await adminApi.makeAdmin(found.user_id);
        // Admin already implies everything staff can do — drop the now-redundant flag.
        if (found.is_staff) await adminApi.removeStaff(found.user_id);
      }
      setFound({ ...found, is_admin: pendingRole === "admin", is_staff: pendingRole === "staff" });
      loadAdmins();
      loadStaff();
    } catch (err) {
      setRoleError(err instanceof ApiError ? err.message : "Couldn't change role.");
      setPendingRole(current);
    } finally {
      setRoleBusy(false);
    }
  }

  // Staff viewers get a single-purpose button (promote a plain member to
  // staff) rather than the admin's role dropdown — saveRole() reads
  // pendingRole from the select, which doesn't exist in that view.
  async function makeStaffDirect() {
    if (!found) return;
    setRoleBusy(true);
    setRoleError(null);
    try {
      await adminApi.makeStaff(found.user_id);
      setFound({ ...found, is_staff: true });
      setPendingRole("staff");
      loadStaff();
    } catch (err) {
      setRoleError(err instanceof ApiError ? err.message : "Couldn't grant staff access.");
    } finally {
      setRoleBusy(false);
    }
  }

  async function quickRemoveStaff(row: AdminRow) {
    const ok = await confirm({
      title: "Remove staff access?",
      message: `${row.name} will lose access to Forms, Courses, and Events management.`,
    });
    if (!ok) return;
    try {
      await adminApi.removeStaff(row.user_id);
      loadStaff();
      if (found?.user_id === row.user_id) {
        setFound({ ...row, is_staff: false });
        setPendingRole("member");
      }
    } catch (err) {
      setRoleError(err instanceof ApiError ? err.message : "Couldn't remove staff access.");
    }
  }

  async function createTag() {
    const name = newTagName.trim();
    if (!name) return;
    setTagError(null);
    try {
      await adminApi.createTag(name);
      setNewTagName("");
      loadTags();
    } catch (err) {
      setTagError(err instanceof ApiError ? err.message : "Couldn't create tag.");
    }
  }

  async function saveRename(tagId: string) {
    const name = renameValue.trim();
    if (!name) return;
    setTagError(null);
    try {
      await adminApi.renameTag(tagId, name);
      setRenamingTagId(null);
      loadTags();
      loadAdmins();
      await refreshFound();
    } catch (err) {
      setTagError(err instanceof ApiError ? err.message : "Couldn't rename tag.");
    }
  }

  async function removeTagDefinition(tagId: string, tagName: string) {
    const ok = await confirm({
      title: "Delete tag?",
      message: `"${tagName}" will be removed from every member who currently has it.`,
    });
    if (!ok) return;
    setTagError(null);
    try {
      await adminApi.deleteTag(tagId);
      loadTags();
      loadAdmins();
      await refreshFound();
    } catch (err) {
      setTagError(err instanceof ApiError ? err.message : "Couldn't delete tag.");
    }
  }

  async function assignPickedTag() {
    if (!found || !pickedTagId) return;
    setRoleError(null);
    try {
      const updated = await adminApi.assignTag(found.user_id, pickedTagId);
      setFound(updated);
      setPickedTagId("");
      loadAdmins();
    } catch (err) {
      setRoleError(err instanceof ApiError ? err.message : "Couldn't assign tag.");
    }
  }

  async function removeMemberTag(tagId: string) {
    if (!found) return;
    setRoleError(null);
    try {
      const updated = await adminApi.unassignTag(found.user_id, tagId);
      setFound(updated);
      loadAdmins();
    } catch (err) {
      setRoleError(err instanceof ApiError ? err.message : "Couldn't remove tag.");
    }
  }

  const availableTags = tags?.filter((t) => !found?.tags.some((ft) => ft.id === t.id)) ?? [];
  const foundRole = found ? roleOf(found) : "member";
  // Staff (not admin) can only promote a plain member to staff — no touching
  // admins, no revoking staff (that's admin-only), so no dropdown for them.
  const canStaffAct = !isAdmin && foundRole === "member";

  return (
    <div className="max-w-160">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">settings · people</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Roles</h1>

      {isAdmin && (
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
                {a.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {a.tags.map((t) => (
                      <span
                        key={t.id}
                        className="rounded-md border border-border-strong px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="rounded-md border border-[#f0dfb8] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-warn">
                admin
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-7 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-[#e8e1d2] px-5 py-3.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          current staff
        </div>
        {staff?.map((s) => (
          <div key={s.user_id} className="flex items-center gap-3.5 border-b border-[#e8e1d2] px-5 py-3.5 last:border-0">
            <div className="grid h-8.5 w-8.5 flex-none place-items-center rounded-full border border-border-strong bg-[#f0ece0] font-mono text-[11px] text-muted">
              {s.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">{s.name}</div>
              <div className="mt-0.5 font-mono text-[10.5px] text-faint">{s.email}</div>
            </div>
            <span className="rounded-md border border-border-strong px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              staff
            </span>
            {isAdmin && (
              <button onClick={() => quickRemoveStaff(s)} className="flex-none text-sm text-danger hover:underline">
                Remove
              </button>
            )}
          </div>
        ))}
        {staff?.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted">No staff yet.</div>}
      </div>

      <div className="mt-7 rounded-xl border border-border bg-surface p-5.5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">change role</div>
        <p className="mt-1.5 text-[13px] text-muted">
          {isAdmin
            ? "Any member can be promoted or demoted — active or not, paid or not."
            : "Promote a member to staff — Forms, Courses, and Events management. Staff can't touch admins or revoke each other."}
        </p>

        {!found && (
          <div className="relative mt-3.5">
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search by name, GitHub username, or email…"
              className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
            />
            {query.trim() && (
              <div className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-md border border-border-strong bg-surface shadow-lg">
                {searching && <div className="px-3.5 py-2.5 text-sm text-faint">Searching…</div>}
                {!searching && results.length === 0 && (
                  <div className="px-3.5 py-2.5 text-sm text-faint">No matches.</div>
                )}
                {!searching &&
                  results.map((r) => (
                    <button
                      key={r.user_id}
                      type="button"
                      onClick={() => pick(r)}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-surface-raised"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px]">{r.name}</span>
                        <span className="block truncate font-mono text-[10.5px] text-faint">{r.email}</span>
                      </span>
                      {roleOf(r) !== "member" && (
                        <span className="flex-none font-mono text-[9.5px] uppercase tracking-[0.1em] text-warn">
                          {roleOf(r)}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {found && (
          <div className="mt-4.5 rounded-lg border border-border-strong p-4">
            <div className="flex flex-wrap items-center gap-3.5">
              <div className="min-w-0 flex-1">
                <div className="text-[15px]">{found.name}</div>
                <div className="mt-0.5 font-mono text-[10.5px] text-faint">{found.email}</div>
              </div>
              <button onClick={clearSelection} className="flex-none text-sm text-muted hover:underline">
                Change
              </button>

              {isAdmin ? (
                <>
                  <select
                    value={pendingRole}
                    onChange={(e) => setPendingRole(e.target.value as Role)}
                    className="rounded-md border border-border-strong bg-background px-3 py-2 font-mono text-[13px] outline-none focus:border-accent"
                  >
                    <option value="member">Member</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={saveRole}
                    disabled={roleBusy || pendingRole === foundRole}
                    className="rounded-md border-0 bg-accent px-4 py-2 text-sm font-medium text-[#1a2744] disabled:opacity-50"
                  >
                    Save
                  </button>
                </>
              ) : canStaffAct ? (
                <button
                  onClick={makeStaffDirect}
                  disabled={roleBusy}
                  className="rounded-md border-0 bg-accent px-4 py-2 text-sm font-medium text-[#1a2744] disabled:opacity-50"
                >
                  Make staff
                </button>
              ) : (
                <span className="flex-none font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
                  {foundRole === "admin" ? "admin" : "already staff"}
                </span>
              )}
            </div>

            {isAdmin && (
              <div className="mt-4 border-t border-[#e8e1d2] pt-3.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">tags</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {found.tags.length === 0 && <span className="text-sm text-faint">No tags yet.</span>}
                  {found.tags.map((t) => (
                    <span
                      key={t.id}
                      className="flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted"
                    >
                      {t.name}
                      <button
                        onClick={() => removeMemberTag(t.id)}
                        className="text-faint hover:text-danger"
                        aria-label={`Remove ${t.name} tag`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                {availableTags.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    <select
                      value={pickedTagId}
                      onChange={(e) => setPickedTagId(e.target.value)}
                      className="flex-1 rounded-md border border-border-strong bg-background px-3 py-2 font-mono text-[13px] outline-none focus:border-accent"
                    >
                      <option value="">Add a tag…</option>
                      {availableTags.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={assignPickedTag}
                      disabled={!pickedTagId}
                      className="rounded-md border border-border-strong px-3.5 py-2 text-sm hover:border-accent-dim disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {roleError && <p className="mt-3.5 text-sm text-danger">{roleError}</p>}
      </div>

      {isAdmin && (
        <div className="mt-7 rounded-xl border border-border bg-surface p-5.5">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">manage tags</div>
          <p className="mt-2 text-[13px] text-muted">
            Tags are decorative labels (Dean, Chairperson, Guest…) admins can pin to a member — they don&apos;t change
            permissions.
          </p>

          <div className="mt-3.5 space-y-2">
            {tags?.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-md border border-border-strong px-3.5 py-2.5">
                {renamingTagId === t.id ? (
                  <>
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      autoFocus
                      className="flex-1 rounded-md border border-border-strong bg-background px-2.5 py-1.5 font-mono text-sm outline-none focus:border-accent"
                    />
                    <button onClick={() => saveRename(t.id)} className="text-sm text-accent-dim hover:underline">
                      Save
                    </button>
                    <button onClick={() => setRenamingTagId(null)} className="text-sm text-faint hover:underline">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{t.name}</span>
                    <button
                      onClick={() => {
                        setRenamingTagId(t.id);
                        setRenameValue(t.name);
                      }}
                      className="text-sm text-muted hover:underline"
                    >
                      Rename
                    </button>
                    <button onClick={() => removeTagDefinition(t.id, t.name)} className="text-sm text-danger hover:underline">
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
            {tags?.length === 0 && <p className="text-sm text-faint">No tags yet.</p>}
          </div>

          <div className="mt-3.5 flex gap-2">
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="e.g. Dean, Treasurer, Guest"
              className="flex-1 rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
            />
            <button
              onClick={createTag}
              className="rounded-md border border-border-strong px-4 py-2.5 text-sm hover:border-accent-dim"
            >
              Create tag
            </button>
          </div>
          {tagError && <p className="mt-3.5 text-sm text-danger">{tagError}</p>}
        </div>
      )}
    </div>
  );
}
