# TODO

Backlog of known gaps and feature ideas — not yet scheduled or scoped in detail.

## Features

- [ ] **Project archiving.** Mirror the event archive pattern (see `Event.archived_at`,
      `app/services/event.py`'s `archive_event`/`unarchive_event`) for projects once a
      project is completed. `Project` currently has no completion/status concept at all —
      this needs that added first, then an archive step on top of it.

## UX

- [x] **Navigation redesign.** Shared `AccountMenu` (Dashboard/Settings/Admin/Sign out) now on
      both the public and admin desktop top bars — admin previously had no way to sign out at
      all. Admin's 11-item horizontal-scroll mobile nav replaced with a grouped drawer
      (People/Programs/Finance/System), matching the same regrouped desktop sidebar. Mobile
      "Profile" tab now opens an account sheet instead of jumping straight to `/dashboard`.
      Design reviewed via artifact before building: https://claude.ai/code/artifact/02acd80e-3584-44f7-9c9f-906f1edfdf99
      Not yet verified on an actual mobile viewport — the browser tool's `resize_window`
      wasn't taking effect this session (`window.innerWidth` stayed at 1920 regardless).
      Worth a real phone check (LAN access) or a retry next session.
- [x] **Confirmation popup on destructive actions** — shared `ConfirmDialog`
      (`components/ConfirmDialog.tsx`, `useConfirm()`) now gates sign-out everywhere, plus
      delete event, remove admin, delete tag, and remove/untrack project. Not every
      destructive-ish action is wired up yet (e.g. reject content/registration/join-request
      were left as-is — lower-stakes, already reversible via other flows) — extend
      `useConfirm()` into more call sites as they come up.
