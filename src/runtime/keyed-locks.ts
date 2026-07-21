/** In-process FIFO serialization for asynchronous work sharing the same key. */
export class KeyedLocks {
  private readonly locks = new Map<string, Promise<void>>();

  /** Runs an operation after earlier work for the same key has settled. */
  public async run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(key, current);
    await previous;

    try {
      return await operation();
    } finally {
      release();
      if (this.locks.get(key) === current) this.locks.delete(key);
    }
  }
}
