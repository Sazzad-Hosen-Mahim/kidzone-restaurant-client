import { useEffect, useRef } from 'react';

/**
 * A ref that always holds the newest value.
 *
 * For effects that must fire on a narrow trigger — a phone number changing, say
 * — but whose body needs the current props when it eventually runs. Putting
 * those props in the dependency array would re-fire the effect; capturing them
 * directly would use whatever they were when the effect started, which for an
 * async callback can be seconds out of date.
 *
 * The ref is seeded during the first render and updated in an effect rather
 * than during render, which is what keeps it safe under concurrent rendering:
 * a render that React throws away never mutates it. Call this hook *above* the
 * effects that read it, so its update runs first within the same commit.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
