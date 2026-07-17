import type { StorageAdapter } from "grammy";
import type {
  CallbackRecord,
  DialogStorageRecord,
  InstanceRecord,
} from "./storage.js";
import { storageKeys } from "./storage.js";

/** Typed, version-aware persistence facade over a grammY storage adapter. */
export class DialogRepository {
  public constructor(
    private readonly storage: StorageAdapter<DialogStorageRecord>,
  ) {}

  /** Reads an instance snapshot. */
  public async readInstance(id: string): Promise<InstanceRecord | undefined> {
    const record = await this.storage.read(storageKeys.instance(id));
    return record?.type === "instance" ? structuredClone(record.value) : undefined;
  }

  /** Persists a structural snapshot of an instance. */
  public async writeInstance(instance: InstanceRecord): Promise<void> {
    await this.storage.write(storageKeys.instance(instance.id), {
      type: "instance",
      version: 1,
      value: structuredClone(instance),
    });
  }

  /** Reads a callback binding by its decoded token. */
  public async readCallback(token: string): Promise<CallbackRecord | undefined> {
    const record = await this.storage.read(storageKeys.callback(token));
    return record?.type === "callback" ? structuredClone(record.value) : undefined;
  }

  /** Persists a structural snapshot of a callback binding. */
  public async writeCallback(token: string, callback: CallbackRecord): Promise<void> {
    await this.storage.write(storageKeys.callback(token), {
      type: "callback",
      version: 1,
      value: structuredClone(callback),
    });
  }

  /** Deletes one callback binding. */
  public async deleteCallback(token: string): Promise<void> {
    await this.storage.delete(storageKeys.callback(token));
  }

  /** Deletes callback bindings sequentially. */
  public async deleteCallbacks(tokens: ReadonlyArray<string>): Promise<void> {
    await Promise.all(tokens.map(token => this.deleteCallback(token)));
  }

  /** Reads the latest focused instance for compatibility with single-focus callers. */
  public async readFocus(
    chatId: number,
    userId: number,
    threadId?: number,
  ): Promise<string | undefined> {
    return (await this.readFocusIds(chatId, userId, threadId)).at(-1);
  }

  /** Reads the ordered list of focused instance ids, including legacy records. */
  public async readFocusIds(
    chatId: number,
    userId: number,
    threadId?: number,
  ): Promise<string[]> {
    const record = await this.storage.read(storageKeys.focus(chatId, userId, threadId));
    if (record?.type !== "focus") return [];
    return record.version === 1
      ? [record.value.instanceId]
      : [...record.value.instanceIds];
  }

  /** Adds an instance as the most recently focused item. */
  public async writeFocus(
    chatId: number,
    userId: number,
    instanceId: string,
    threadId?: number,
  ): Promise<void> {
    const current = await this.readFocusIds(chatId, userId, threadId);
    await this.writeFocusIds(
      chatId,
      userId,
      [...current.filter(id => id !== instanceId), instanceId],
      threadId,
    );
  }

  /** Replaces or removes the complete ordered focus list. */
  public async writeFocusIds(
    chatId: number,
    userId: number,
    instanceIds: ReadonlyArray<string>,
    threadId?: number,
  ): Promise<void> {
    const key = storageKeys.focus(chatId, userId, threadId);
    if (instanceIds.length === 0) {
      await this.storage.delete(key);
      return;
    }
    await this.storage.write(key, {
      type: "focus",
      version: 2,
      value: { instanceIds: [...instanceIds] },
    });
  }

  /** Removes an instance from focus without disturbing other active instances. */
  public async deleteFocusIfOwned(
    chatId: number,
    userId: number,
    instanceId: string,
    threadId?: number,
  ): Promise<void> {
    const instanceIds = await this.readFocusIds(chatId, userId, threadId);
    if (!instanceIds.includes(instanceId)) return;
    await this.writeFocusIds(
      chatId,
      userId,
      instanceIds.filter(id => id !== instanceId),
      threadId,
    );
  }
}
