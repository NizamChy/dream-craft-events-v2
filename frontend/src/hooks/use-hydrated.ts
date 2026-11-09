import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during SSR and the first client render, true afterwards. Use it to gate UI that depends on localStorage (e.g. the cart). */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
