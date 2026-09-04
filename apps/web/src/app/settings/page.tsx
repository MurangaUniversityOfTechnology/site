"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, authApi } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import SignaturePanel from "@/components/SignaturePanel";
import ProfilePanel from "@/components/ProfilePanel";
import PasswordInput from "@/components/PasswordInput";
import { signInHref } from "@/lib/nextParam";

type Category = "account" | "profile" | "signature";

export default function SettingsPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const [category, setCategory] = useState<Category>("account");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.push(signInHref("/settings"));
  }, [loading, me, router]);

  if (loading || !me) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await authApi.changePassword({ current_password: currentPassword.trim() || null, new_password: newPassword });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change your password.");
    } finally {
      setBusy(false);
    }
  }

  const categories: { id: Category; label: string }[] = [
    { id: "account", label: "Account" },
    { id: "profile", label: "Profile" },
    { id: "signature", label: "Signature" },
  ];

  return (
    <main className="px-5 py-10 sm:px-8 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">settings</div>
      <h1 className="mt-3.5 text-[clamp(28px,4vw,42px)] leading-none tracking-[-0.04em]">Settings</h1>
      <p className="mt-2.5 max-w-120 text-[14px] leading-[1.55] text-muted">
        Password, profile details, and your signature.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr] md:gap-8">
        <nav className="flex gap-1.5 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`whitespace-nowrap rounded-md px-3 py-2.5 text-left text-sm ${
                category === c.id ? "bg-navy/8 font-medium text-navy" : "text-muted hover:bg-surface-raised hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {category === "account" && (
            <div className="max-w-105 rounded-xl border border-border bg-surface p-6">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">change password</div>
              <p className="mt-2.5 text-[14px] leading-[1.55] text-muted">
                Signed in as <span className="text-foreground">{me.email}</span>. If you were given a one-time
                password by an admin, set your own here.
              </p>

              <form onSubmit={submit} className="mt-5.5 flex flex-col gap-4">
                <Field label="Current password (leave blank if you don't have one yet)">
                  <PasswordInput
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </Field>
                <Field label="New password">
                  <PasswordInput
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </Field>
                <Field label="Confirm new password">
                  <PasswordInput
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </Field>

                {error && <p className="text-sm text-danger">{error}</p>}
                {success && <p className="text-sm text-navy">Password updated ✓</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-1 w-fit rounded-lg bg-accent px-6 py-3 text-[14.5px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Update password"}
                </button>
              </form>
            </div>
          )}

          {category === "profile" && <ProfilePanel />}

          {category === "signature" && <SignaturePanel />}
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{label}</div>
      <div className="mt-2">{children}</div>
    </label>
  );
}
