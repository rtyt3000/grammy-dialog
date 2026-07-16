import type { StorageAdapter } from "grammy";
import type {
  CallbackRecord,
  DialogStorageRecord,
  InstanceRecord,
} from "./storage.js";
import { storageKeys } from "./storage.js";

export class DialogRepository {
  public constructor(
    private readonly storage: StorageAdapter<DialogStorageRecord>,
  ) {}

  public async readInstance(id: string): Promise<InstanceRecord | undefined> {
    const record = await this.storage.read(storageKeys.instance(id));
    return record?.type === "instance" ? structuredClone(record.value) : undefined;
  }

  public async writeInstance(instance: InstanceRecord): Promise<void> {
    await this.storage.write(storageKeys.instance(instance.id), {
      type: "instance",
      version: 1,
      value: structuredClone(instance),
    });
  }

  public async readCallback(token: string): Promise<CallbackRecord | undefined> {
    const record = await this.storage.read(storageKeys.callback(token));
    return record?.type === "callback" ? structuredClone(record.value) : undefined;
  }

  public async writeCallback(token: string, callback: CallbackRecord): Promise<void> {
    await this.storage.write(storageKeys.callback(token), {
      type: "callback",
      version: 1,
      value: structuredClone(callback),
    });
  }

  public async deleteCallback(token: string): Promise<void> {
    await this.storage.delete(storageKeys.callback(token));
  }

  public async deleteCallbacks(tokens: ReadonlyArray<string>): Promise<void> {
    await Promise.all(tokens.map(token => this.deleteCallback(token)));
  }

  public async readFocus(
    chatId: number,
    userId: number,
    threadId?: number,
  ): Promise<string | undefined> {
    const record = await this.storage.read(storageKeys.focus(chatId, userId, threadId));
    return record?.type === "focus" ? record.value.instanceId : undefined;
  }

  public async writeFocus(
    chatId: number,
    userId: number,
    instanceId: string,
    threadId?: number,
  ): Promise<void> {
    await this.storage.write(storageKeys.focus(chatId, userId, threadId), {
      type: "focus",
      version: 1,
      value: { instanceId },
    });
  }

  public async deleteFocusIfOwned(
    chatId: number,
    userId: number,
    instanceId: string,
    threadId?: number,
  ): Promise<void> {
    const key = storageKeys.focus(chatId, userId, threadId);
    const record = await this.storage.read(key);
    if (record?.type === "focus" && record.value.instanceId === instanceId) {
      await this.storage.delete(key);
    }
  }
}
