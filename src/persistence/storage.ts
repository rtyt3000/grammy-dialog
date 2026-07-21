import type { StorageAdapter } from "grammy";
import type { ButtonAction, MediaKind } from "../core.js";

/** Serializes all operations for one scoped identity across runtime processes. */
export interface IdentityCoordinator {
  run<T>(identity: string, operation: () => Promise<T>): Promise<T>;
}

/** Storage adapter that also provides distributed identity serialization. */
export interface CoordinatedStorageAdapter<T> extends StorageAdapter<T> {
  readonly identities: IdentityCoordinator;
}

/** Persisted navigation stack entry. */
export interface StackFrame {
  windowId: string;
  data?: unknown;
}

/** Persisted reference to the Telegram message owned by an instance. */
export interface SurfaceReference {
  chatId: number;
  messageId: number;
  kind: "text" | MediaKind;
  hasKeyboard: boolean;
}

/** Complete persisted state of one dialog or standalone-window instance. */
export interface InstanceRecord {
  id: string;
  kind: "dialog" | "standalone";
  definitionId: string;
  ownerId?: number;
  chatId: number;
  threadId?: number;
  scopeKey: string;
  key?: string;
  stack: StackFrame[];
  state: unknown;
  locale: string;
  revision: number;
  status: "active" | "closed";
  surface?: SurfaceReference;
  callbackTokens: string[];
  widgetStates: Record<string, { version: number; value: unknown }>;
  focusedUserIds: number[];
  result?: unknown;
}

/** Persisted callback token binding validated against an instance revision. */
export interface CallbackRecord {
  instanceId: string;
  revision: number;
  action: ButtonAction;
  chatId: number;
  expiresAt?: number;
}

/** Versioned union stored through a grammY `StorageAdapter`. */
export type DialogStorageRecord =
  | { type: "instance"; version: 1; value: InstanceRecord }
  | { type: "callback"; version: 1; value: CallbackRecord }
  | { type: "focus"; version: 1; value: { instanceId: string } }
  | { type: "focus"; version: 2; value: { instanceIds: string[] } }
  | { type: "identity"; version: 1; value: { instanceId: string } };

/** Non-persistent `StorageAdapter` suitable for development and tests. */
export class MemoryStorageAdapter<T> implements CoordinatedStorageAdapter<T> {
  private readonly values = new Map<string, T>();
  private readonly identityLocks = new Map<string, Promise<void>>();

  /** Process-local coordinator shared by every runtime using this adapter instance. */
  public readonly identities: IdentityCoordinator = {
    run: (identity, operation) => this.runIdentity(identity, operation),
  };

  /** Reads a value by its storage key. */
  public read(key: string): T | undefined {
    return this.values.get(key);
  }

  /** Writes or replaces a value by its storage key. */
  public write(key: string, value: T): void {
    this.values.set(key, value);
  }

  /** Deletes a value if it exists. */
  public delete(key: string): void {
    this.values.delete(key);
  }

  /** Returns whether a value exists for the key. */
  public has(key: string): boolean {
    return this.values.has(key);
  }

  /** Iterates over all currently stored keys. */
  public readAllKeys(): Iterable<string> {
    return this.values.keys();
  }

  /** Iterates over all currently stored values. */
  public readAllValues(): Iterable<T> {
    return this.values.values();
  }

  /** Iterates over all currently stored key-value pairs. */
  public readAllEntries(): Iterable<[string, T]> {
    return this.values.entries();
  }

  private async runIdentity<Result>(
    identity: string,
    operation: () => Promise<Result>,
  ): Promise<Result> {
    const previous = this.identityLocks.get(identity) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.identityLocks.set(identity, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.identityLocks.get(identity) === current)
        this.identityLocks.delete(identity);
    }
  }
}

/** Canonical storage-key builders used by the dialog repository. */
export const storageKeys = {
  instance: (id: string) => `gd:instance:${id}`,
  callback: (token: string) => `gd:callback:${token}`,
  focus: (chatId: number, userId: number, threadId?: number) =>
    `gd:focus:${chatId}:${threadId ?? "root"}:${userId}`,
  identity: (scopeKey: string, definitionId: string, key: string) =>
    `gd:identity:${encodeURIComponent(scopeKey)}:${encodeURIComponent(definitionId)}:${encodeURIComponent(key)}`,
};
