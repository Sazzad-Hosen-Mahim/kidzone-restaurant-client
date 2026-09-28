import { useEffect, useState } from 'react';

/**
 * Delays a value until it stops changing.
 *
 * Used on every search box: without it, each keystroke is a request, and the
 * responses can arrive out of order and show results for a prefix of what the
 * user typed.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
