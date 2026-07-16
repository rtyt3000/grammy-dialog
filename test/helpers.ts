import type { Context, StorageAdapter } from "grammy";
import type { DialogFlavor } from "../src/index.js";

export type TestContext = Context & DialogFlavor;

export class JsonStorageAdapter<T> implements StorageAdapter<T> {
  protected readonly values = new Map<string, string>();
  private nextWriteFailure?: { prefix: string; error: Error; remaining: number };
  private nextDeleteFailure?: { prefix: string; error: Error };

  public read(key: string): T | undefined {
    const value = this.values.get(key);
    return value === undefined ? undefined : JSON.parse(value) as T;
  }

  public write(key: string, value: T): void {
    if (this.nextWriteFailure !== undefined && key.startsWith(this.nextWriteFailure.prefix)) {
      const { error } = this.nextWriteFailure;
      this.nextWriteFailure.remaining -= 1;
      if (this.nextWriteFailure.remaining === 0) this.nextWriteFailure = undefined;
      throw error;
    }
    this.values.set(key, JSON.stringify(value));
  }

  public delete(key: string): void {
    if (this.nextDeleteFailure !== undefined && key.startsWith(this.nextDeleteFailure.prefix)) {
      const { error } = this.nextDeleteFailure;
      this.nextDeleteFailure = undefined;
      throw error;
    }
    this.values.delete(key);
  }

  public readAllKeys(): Iterable<string> {
    return this.values.keys();
  }

  public readAllValues(): Iterable<T> {
    return [...this.values.values()].map(value => JSON.parse(value) as T);
  }

  public failNextWrite(prefix: string, error = new Error("storage write failed")): void {
    this.failNextWrites(prefix, 1, error);
  }

  public failNextWrites(
    prefix: string,
    count: number,
    error = new Error("storage write failed"),
  ): void {
    if (!Number.isInteger(count) || count < 1) {
      throw new RangeError("Write failure count must be a positive integer");
    }
    this.nextWriteFailure = { prefix, error, remaining: count };
  }

  public failNextDelete(prefix: string, error = new Error("storage delete failed")): void {
    this.nextDeleteFailure = { prefix, error };
  }
}
