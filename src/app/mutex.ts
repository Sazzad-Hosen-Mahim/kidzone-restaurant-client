/**
 * A minimal async mutex.
 *
 * Only one thing needs it — serialising token refreshes — and that one thing is
 * important enough to be worth reading in full rather than pulling in a
 * dependency for twenty lines.
 */
export class Mutex {
  private locked = false;
  private waiters: Array<() => void> = [];

  isLocked(): boolean {
    return this.locked;
  }

  /** Takes the lock, resolving to the function that releases it. */
  async acquire(): Promise<() => void> {
    while (this.locked) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }

    this.locked = true;
    let released = false;

    return () => {
      // Releasing twice would hand the lock to two callers at once.
      if (released) return;
      released = true;
      this.locked = false;
      const waiters = this.waiters;
      this.waiters = [];
      for (const wake of waiters) wake();
    };
  }

  /** Resolves once the lock is free, without taking it. */
  async waitForUnlock(): Promise<void> {
    while (this.locked) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
  }
}
