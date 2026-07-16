import type { StorageAdapter } from "grammy";
import type { ButtonAction } from "./core.js";

export interface StackFrame {
  windowId: string;
  data?: unknown;
}

export interface SurfaceReference {
  chatId: number;
  messageId: number;
  kind: "text" | "photo";
  hasKeyboard: boolean;
}

export interface InstanceRecord {
  id: string;
  kind: "dialog" | "standalone";
  definitionId: string;
  ownerId?: number;
  chatId: number;
  threadId?: number;
  scopeKey: string;
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

export interface CallbackRecord {
  instanceId: string;
  windowId: string;
  revision: number;
  action: ButtonAction;
  chatId: number;
  allowedUserId?: number;
  expiresAt?: number;
}

export type DialogStorageRecord =
  | { type: "instance"; version: 1; value: InstanceRecord }
  | { type: "callback"; version: 1; value: CallbackRecord }
  | { type: "focus"; version: 1; value: { instanceId: string } };

export class MemoryStorageAdapter<T> implements StorageAdapter<T> {
  private readonly values = new Map<string, T>();

  public read(key: string): T | undefined {
    return this.values.get(key);
  }

  public write(key: string, value: T): void {
    this.values.set(key, value);
  }

  public delete(key: string): void {
    this.values.delete(key);
  }

  public has(key: string): boolean {
    return this.values.has(key);
  }

  public readAllKeys(): Iterable<string> {
    return this.values.keys();
  }

  public readAllValues(): Iterable<T> {
    return this.values.values();
  }

  public readAllEntries(): Iterable<[string, T]> {
    return this.values.entries();
  }
}

export const storageKeys = {
  instance: (id: string) => `gd:instance:${id}`,
  callback: (token: string) => `gd:callback:${token}`,
  focus: (chatId: number, userId: number, threadId?: number) =>
    `gd:focus:${chatId}:${threadId ?? "root"}:${userId}`,
};
