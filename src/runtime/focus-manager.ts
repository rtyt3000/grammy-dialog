import type { InstanceRecord } from "../persistence/storage.js";
import type { DialogRepository } from "../persistence/dialog-repository.js";
import { KeyedLocks } from "./keyed-locks.js";

/** Atomically coordinates focus-list persistence with an instance operation. */
export class FocusManager {
  private readonly locks = new KeyedLocks();

  public constructor(private readonly repository: DialogRepository) {}

  /** Adds focus before an operation and restores both records when it fails. */
  public async commit(
    instance: InstanceRecord,
    userId: number | undefined,
    operation: () => Promise<void>,
  ): Promise<void> {
    if (userId === undefined) {
      await operation();
      return;
    }

    await this.locks.run(
      `${instance.chatId}:${instance.threadId ?? "root"}:${userId}`,
      () => this.commitLocked(instance, userId, operation),
    );
  }

  private async commitLocked(
    instance: InstanceRecord,
    userId: number,
    operation: () => Promise<void>,
  ): Promise<void> {
    const previous = await this.repository.readFocusIds(
      instance.chatId,
      userId,
      instance.threadId,
    );
    if (!instance.focusedUserIds.includes(userId))
      instance.focusedUserIds.push(userId);
    let changed = false;

    try {
      if (previous.at(-1) !== instance.id) {
        await this.repository.writeFocusIds(
          instance.chatId,
          userId,
          [...previous.filter((id) => id !== instance.id), instance.id],
          instance.threadId,
        );
        changed = true;
      }
      await operation();
    } catch (error) {
      if (changed) {
        try {
          await this.repository.writeFocusIds(
            instance.chatId,
            userId,
            previous,
            instance.threadId,
          );
        } catch (recoveryError) {
          throw new AggregateError(
            [error, recoveryError],
            `Failed to restore focus for instance '${instance.id}'`,
          );
        }
      }
      throw error;
    }
  }
}
