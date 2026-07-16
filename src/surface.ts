import type { Api, Context } from "grammy";
import type { RenderedWindow, WindowRenderer } from "./renderer.js";
import type { DialogRepository } from "./repository.js";
import type { InstanceRecord, SurfaceReference } from "./storage.js";

export class SurfaceManager<
  C extends Context = Context,
  Services = unknown,
> {
  public constructor(
    private readonly renderer: WindowRenderer<C, Services>,
    private readonly repository: DialogRepository,
  ) {}

  public async mount(api: Api, instance: InstanceRecord, ctx?: C): Promise<void> {
    const rendered = await this.renderer.render(instance, ctx);
    let messageId: number | undefined;
    try {
      const message = await this.send(api, instance, rendered);
      messageId = message.message_id;
      instance.surface = this.surface(instance, messageId, rendered);
      instance.callbackTokens = rendered.callbackTokens;
      await this.repository.writeInstance(instance);
    } catch (error) {
      const orphanMessageId = messageId;
      if (orphanMessageId !== undefined) {
        await this.ignoreFailure(() => api.deleteMessage(instance.chatId, orphanMessageId));
      }
      await this.repository.deleteCallbacks(rendered.callbackTokens);
      throw error;
    }
  }

  public async rerender(api: Api, instance: InstanceRecord, ctx?: C): Promise<void> {
    if (instance.surface === undefined) throw new Error(`Instance '${instance.id}' has no surface`);
    const previous = await this.repository.readInstance(instance.id);
    if (previous?.surface === undefined) {
      throw new Error(`Persisted instance '${instance.id}' has no surface`);
    }
    const rendered = await this.renderer.render(instance, ctx);
    const replacement = previous.surface.kind !== (rendered.photo === undefined ? "text" : "photo");
    let telegramApplied = false;
    let replacementMessageId: number | undefined;

    try {
      if (replacement) {
        const message = await this.send(api, instance, rendered);
        replacementMessageId = message.message_id;
        instance.surface = this.surface(instance, replacementMessageId, rendered);
      } else {
        await this.edit(api, previous.surface, rendered);
        telegramApplied = true;
        instance.surface = this.surface(instance, previous.surface.messageId, rendered);
      }

      instance.callbackTokens = rendered.callbackTokens;
      await this.repository.writeInstance(instance);
    } catch (error) {
      const orphanMessageId = replacementMessageId;
      if (orphanMessageId !== undefined) {
        await this.ignoreFailure(() => api.deleteMessage(instance.chatId, orphanMessageId));
        await this.ignoreFailure(() => this.repository.deleteCallbacks(rendered.callbackTokens));
      } else if (telegramApplied) {
        await this.rollbackEdit(api, previous, rendered.callbackTokens, ctx);
      } else {
        await this.ignoreFailure(() => this.repository.deleteCallbacks(rendered.callbackTokens));
      }
      throw error;
    }

    // Storage now points at the new surface. Cleanup must never compensate a
    // committed replacement; stale messages and tokens can safely expire later.
    if (replacementMessageId !== undefined) {
      await this.ignoreFailure(() => api.deleteMessage(previous.chatId, previous.surface!.messageId));
    }
    await this.ignoreFailure(() => this.repository.deleteCallbacks(previous.callbackTokens));
  }

  public async detachKeyboard(api: Api, instance: InstanceRecord): Promise<void> {
    if (instance.surface?.hasKeyboard !== true) return;
    await api.editMessageReplyMarkup(instance.surface.chatId, instance.surface.messageId, {
      reply_markup: { inline_keyboard: [] },
    });
    instance.surface.hasKeyboard = false;
  }

  private async rollbackEdit(
    api: Api,
    previous: InstanceRecord,
    failedTokens: ReadonlyArray<string>,
    ctx?: C,
  ): Promise<void> {
    const rollback = await this.renderer.render(previous, ctx);
    const originalTokens = previous.callbackTokens;
    let telegramApplied = false;
    try {
      await this.edit(api, previous.surface!, rollback);
      telegramApplied = true;
      previous.callbackTokens = rollback.callbackTokens;
      previous.surface = this.surface(previous, previous.surface!.messageId, rollback);
      await this.repository.writeInstance(previous);
    } catch (rollbackError) {
      if (!telegramApplied) {
        await this.ignoreFailure(() => this.repository.deleteCallbacks(rollback.callbackTokens));
      }
      throw new AggregateError(
        [rollbackError],
        `Failed to roll back Telegram surface for instance '${previous.id}'`,
      );
    }

    // The rollback is committed. Its callbacks belong to the visible surface
    // and must survive any best-effort cleanup failure.
    await this.ignoreFailure(() =>
      this.repository.deleteCallbacks([...originalTokens, ...failedTokens])
    );
  }

  private async send(api: Api, instance: InstanceRecord, rendered: RenderedWindow) {
    return rendered.photo === undefined
      ? api.sendMessage(instance.chatId, rendered.text || "\u2063", {
        reply_markup: rendered.replyMarkup,
        ...this.threadOptions(instance),
      })
      : api.sendPhoto(instance.chatId, rendered.photo, {
        caption: rendered.text || undefined,
        reply_markup: rendered.replyMarkup,
        ...this.threadOptions(instance),
      });
  }

  private async edit(
    api: Api,
    surface: SurfaceReference,
    rendered: RenderedWindow,
  ): Promise<void> {
    if (surface.kind === "text" && rendered.photo === undefined) {
      await api.editMessageText(surface.chatId, surface.messageId, rendered.text || "\u2063", {
        reply_markup: rendered.replyMarkup,
      });
      return;
    }
    if (surface.kind === "photo" && rendered.photo !== undefined) {
      await api.editMessageMedia(surface.chatId, surface.messageId, {
        type: "photo",
        media: rendered.photo,
        caption: rendered.text || undefined,
      }, { reply_markup: rendered.replyMarkup });
      return;
    }
    throw new Error(`Cannot edit '${surface.kind}' surface with a different media kind`);
  }

  private surface(
    instance: InstanceRecord,
    messageId: number,
    rendered: RenderedWindow,
  ): SurfaceReference {
    return {
      chatId: instance.chatId,
      messageId,
      kind: rendered.photo === undefined ? "text" : "photo",
      hasKeyboard: rendered.replyMarkup !== undefined,
    };
  }

  private threadOptions(instance: InstanceRecord): { message_thread_id?: number } {
    return instance.threadId === undefined ? {} : { message_thread_id: instance.threadId };
  }

  private async ignoreFailure(operation: () => Promise<unknown>): Promise<void> {
    try {
      await operation();
    } catch {
      // Compensation is best effort; the original error remains authoritative.
    }
  }
}
