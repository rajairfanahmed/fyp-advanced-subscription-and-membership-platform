import { useCallback, useRef, useState } from "react";

/**
 * Synchronous lock for demo CTAs. React `useState` alone is too slow —
 * five rapid clicks all pass `if (pending)` before the first re-render.
 */
export function useInFlightLock() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);

  const begin = useCallback(() => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    return true;
  }, []);

  const end = useCallback(() => {
    lock.current = false;
    setBusy(false);
  }, []);

  return { begin, end, busy };
}
