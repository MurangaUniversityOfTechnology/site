"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmDialog";
import { authApi } from "@/lib/api";
import { useMe } from "@/lib/useMe";

/** Shared by the desktop account menu, the mobile profile sheet, and the
 * admin drawer — confirms, signs out, and lands back on the homepage. */
export function useSignOut() {
  const { refresh } = useMe();
  const router = useRouter();
  const confirm = useConfirm();

  return useCallback(async () => {
    const ok = await confirm({
      title: "Sign out?",
      message: "You'll need to sign in again to get back to your dashboard or the admin panel.",
      confirmLabel: "Sign out",
    });
    if (!ok) return;
    await authApi.logout();
    await refresh();
    router.push("/");
  }, [confirm, refresh, router]);
}
