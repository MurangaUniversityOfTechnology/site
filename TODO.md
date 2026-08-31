# TODO

Backlog of known gaps and feature ideas — not yet scheduled or scoped in detail.

## Features

- [x] **Project archiving.** `Project` gained `completed_at` (admin-set, no objective
      signal like an event's `starts_at` to compute it from) and `archived_at`, mirroring
      `Event`. Archiving requires completion first — same "has to be earned" gate as an
      event needing to have already happened. Admin projects page has Active/Archived tabs
      plus Complete/Undo/Archive/Unarchive/Remove actions; public `/projects` excludes
      archived and shows a "completed" badge; a completed project can no longer be joined.
      Archive is confirm-gated via the shared `ConfirmDialog`.

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
