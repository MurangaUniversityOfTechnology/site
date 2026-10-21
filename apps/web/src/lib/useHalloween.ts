"use client";

import { useSyncExternalStore } from "react";
import { isHalloween } from "@/lib/season";

const noSubscribe = () => () => {};

/** False on the server and during hydration, then the real answer — so the
 * seasonal decorations never cause a hydration mismatch. */
export function useHalloween(): boolean {
  return useSyncExternalStore(noSubscribe, () => isHalloween(), () => false);
}
