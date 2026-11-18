"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True after hydration, so browser-only features don't cause hydration mismatches. */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
