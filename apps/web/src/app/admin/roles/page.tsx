"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, adminApi, type AdminRow, type Tag } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
import { useMe } from "@/lib/useMe";

export default function AdminRolesPage() {
  const { me } = useMe();
  const isAdmin = me?.is_admin ?? false;

  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<AdminRow | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [tags, setTags] = useState<Tag[] | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pickedTagId, setPickedTagId] = useState("");
  const confirm = useConfirm();

  const [staff, setStaff] = useState<AdminRow[] | null>(null);
  const [staffQuery, setStaffQuery] = useState("");
  const [staffResults, setStaffResults] = useState<AdminRow[]>([]);
  const [staffSearching, setStaffSearching] = useState(false);
  const [staffFound, setStaffFound] = useState<AdminRow | undefined>(undefined);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffBusy, setStaffBusy] = useState(false);

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
    const q = staffQuery.trim();
    if (!q || staffFound) return;
    const timeout = setTimeout(() => {
      adminApi
        .searchUsers(q)
        .then(setStaffResults)
        .finally(() => setStaffSearching(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [staffQuery, staffFound]);

  function handleStaffQueryChange(value: string) {
    setStaffQuery(value);
    if (value.trim()) setStaffSearching(true);
  }

  function pickStaff(row: AdminRow) {
    setStaffFound(row);
    setStaffResults([]);
    setStaffQuery("");
  }

  function clearStaffSelection() {
    setStaffFound(undefined);
    setStaffError(null);
  }

  async function grantStaff() {
    if (!staffFound) return;
    setStaffBusy(true);
    setStaffError(null);
    try {
      await adminApi.makeStaff(staffFound.user_id);
      setStaffFound({ ...staffFound, is_staff: true });
      loadStaff();
    } catch (err) {
      setStaffError(err instanceof ApiError ? err.message : "Couldn't grant staff access.");
    } finally {
      setStaffBusy(false);
    }
  }

  async function revokeStaff(row: AdminRow) {
    const ok = await confirm({
      title: "Remove staff access?",
      message: `${row.name} will lose access to Forms, Courses, and Events management.`,
    });
    if (!ok) return;
    setStaffError(null);
    try {
      await adminApi.removeStaff(row.user_id);
      loadStaff();
      if (staffFound?.user_id === row.user_id) setStaffFound({ ...row, is_staff: false });
    } catch (err) {
      setStaffError(err instanceof ApiError ? err.message : "Couldn't remove staff access.");
    }
  }

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
    setResults([]);
    setQuery("");
  }

  function clearSelection() {
    setFound(undefined);
    setError(null);
  }

  async function refreshFound() {
    if (!found) return;
    const matches = await adminApi.searchUsers(found.email);
    setFound(matches.find((m) => m.user_id === found.user_id) ?? found);
  }

  async function toggle() {
    if (!found) return;
    const ok = await confirm(
      found.is_admin
        ? {
            title: "Remove admin access?",
            message: `${found.name} will lose access to the admin panel. They'll keep their membership.`,
          }
        : {
            title: "Make admin?",
            message: `${found.name} will get full access to the admin panel — members, payments, content, everything. They'll get an email letting them know.`,
          },
    );
    if (!ok) return;
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
    setError(null);
    try {
      const updated = await adminApi.assignTag(found.user_id, pickedTagId);
      setFound(updated);
      setPickedTagId("");
      loadAdmins();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't assign tag.");
    }
  }

  async function removeMemberTag(tagId: string) {
    if (!found) return;
    setError(null);
    try {
      const updated = await adminApi.unassignTag(found.user_id, tagId);
      setFound(updated);
      loadAdmins();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove tag.");
    }
  }

  const availableTags = tags?.filter((t) => !found?.tags.some((ft) => ft.id === t.id)) ?? [];

  return (
    <div className="max-w-160">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">settings · people</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Roles</h1>

      {isAdmin && (
        <>
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

      <div className="mt-7 rounded-xl border border-border bg-surface p-5.5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">grant or revoke access</div>
        <p className="mt-1.5 text-[13px] text-muted">
          Any member can be promoted — active or not, paid or not.
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
                      {r.is_admin && (
                        <span className="flex-none font-mono text-[9.5px] uppercase tracking-[0.1em] text-warn">
                          admin
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
            <div className="flex items-center gap-3.5">
              <div className="min-w-0 flex-1">
                <div className="text-[15px]">{found.name}</div>
                <div className="mt-0.5 font-mono text-[10.5px] text-faint">{found.email}</div>
              </div>
              <button onClick={clearSelection} className="flex-none text-sm text-muted hover:underline">
                Change
              </button>
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
          </div>
        )}
        {error && <p className="mt-3.5 text-sm text-danger">{error}</p>}
      </div>

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
        </>
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
              <button onClick={() => revokeStaff(s)} className="flex-none text-sm text-danger hover:underline">
                Remove
              </button>
            )}
          </div>
        ))}
        {staff?.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted">No staff yet.</div>}
      </div>

      <div className="mt-7 rounded-xl border border-border bg-surface p-5.5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">grant staff access</div>
        <p className="mt-1.5 text-[13px] text-muted">
          Staff can manage Forms, Courses, Events (and Arms) — never members, payments, or the audit log. Any member
          can be promoted, and staff can promote each other.
        </p>

        {!staffFound && (
          <div className="relative mt-3.5">
            <input
              value={staffQuery}
              onChange={(e) => handleStaffQueryChange(e.target.value)}
              placeholder="Search by name, GitHub username, or email…"
              className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
            />
            {staffQuery.trim() && (
              <div className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-md border border-border-strong bg-surface shadow-lg">
                {staffSearching && <div className="px-3.5 py-2.5 text-sm text-faint">Searching…</div>}
                {!staffSearching && staffResults.length === 0 && (
                  <div className="px-3.5 py-2.5 text-sm text-faint">No matches.</div>
                )}
                {!staffSearching &&
                  staffResults.map((r) => (
                    <button
                      key={r.user_id}
                      type="button"
                      onClick={() => pickStaff(r)}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-surface-raised"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px]">{r.name}</span>
                        <span className="block truncate font-mono text-[10.5px] text-faint">{r.email}</span>
                      </span>
                      {(r.is_admin || r.is_staff) && (
                        <span className="flex-none font-mono text-[9.5px] uppercase tracking-[0.1em] text-warn">
                          {r.is_admin ? "admin" : "staff"}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {staffFound && (
          <div className="mt-4.5 rounded-lg border border-border-strong p-4">
            <div className="flex items-center gap-3.5">
              <div className="min-w-0 flex-1">
                <div className="text-[15px]">{staffFound.name}</div>
                <div className="mt-0.5 font-mono text-[10.5px] text-faint">{staffFound.email}</div>
              </div>
              <button onClick={clearStaffSelection} className="flex-none text-sm text-muted hover:underline">
                Change
              </button>
              {staffFound.is_staff ? (
                isAdmin ? (
                  <button
                    onClick={() => revokeStaff(staffFound)}
                    className="rounded-md border border-[#f6d9d6] px-4 py-2 text-sm font-medium text-danger"
                  >
                    Remove staff
                  </button>
                ) : (
                  <span className="flex-none font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
                    already staff
                  </span>
                )
              ) : (
                <button
                  onClick={grantStaff}
                  disabled={staffBusy}
                  className="rounded-md border-0 bg-accent px-4 py-2 text-sm font-medium text-[#1a2744] disabled:opacity-50"
                >
                  Make staff
                </button>
              )}
            </div>
          </div>
        )}
        {staffError && <p className="mt-3.5 text-sm text-danger">{staffError}</p>}
      </div>
    </div>
  );
}
