import type { Api, Context, InputFile } from "grammy";
import type { InputMedia, ParseMode } from "grammy/types";
import type { RenderedMedia, RenderedWindow, WindowRenderer } from "./window-renderer.js";
import type { DialogRepository } from "../persistence/dialog-repository.js";
import type { InstanceRecord, SurfaceReference } from "../persistence/storage.js";
import { PresentationPlanner } from "../presentation/planner.js";
import type {
  CloseOperation,
  CloseStrategy,
  PresentationOperation,
} from "../presentation/contracts.js";

export class SurfaceManager<
  C extends Context = Context,
  Services = unknown,
> {
  public constructor(
    private readonly renderer: WindowRenderer<C, Services>,
    private readonly repository: DialogRepository,
    private readonly planner: PresentationPlanner,
    private readonly closeStrategy: CloseStrategy,
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
    let operation = await this.planner.plan(previous.surface, rendered);
    let telegramApplied = false;
    let replacementMessageId: number | undefined;

    try {
      if (operation === "edit") {
        try {
          await this.edit(api, previous.surface, rendered);
          telegramApplied = true;
          instance.surface = this.surface(instance, previous.surface.messageId, rendered);
        } catch (editError) {
          if (await this.planner.fallbackAfterEditError(editError) === "throw") throw editError;
          operation = "replace";
          const message = await this.send(api, instance, rendered);
          replacementMessageId = message.message_id;
          instance.surface = this.surface(instance, replacementMessageId, rendered);
        }
      } else {
        const message = await this.send(api, instance, rendered);
        replacementMessageId = message.message_id;
        instance.surface = this.surface(instance, replacementMessageId, rendered);
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
      await this.cleanupPreviousSurface(api, previous.surface, operation);
    }
    await this.ignoreFailure(() => this.repository.deleteCallbacks(previous.callbackTokens));
  }

  public async planClose(instance: InstanceRecord): Promise<CloseOperation> {
    if (instance.surface === undefined) return "keep";
    return await this.closeStrategy.plan({ instance, surface: instance.surface });
  }

  public async applyClose(
    api: Api,
    surface: SurfaceReference | undefined,
    operation: CloseOperation,
  ): Promise<void> {
    if (surface === undefined || operation === "keep") return;
    if (operation === "delete") {
      await api.deleteMessage(surface.chatId, surface.messageId);
      return;
    }
    if (!surface.hasKeyboard) return;
    await api.editMessageReplyMarkup(surface.chatId, surface.messageId, {
      reply_markup: { inline_keyboard: [] },
    });
  }

  private async cleanupPreviousSurface(
    api: Api,
    surface: SurfaceReference,
    operation: PresentationOperation,
  ): Promise<void> {
    if (operation === "replace") {
      await this.ignoreFailure(() => api.deleteMessage(surface.chatId, surface.messageId));
      return;
    }
    if (operation === "send" && surface.hasKeyboard) {
      await this.ignoreFailure(() => api.editMessageReplyMarkup(surface.chatId, surface.messageId, {
        reply_markup: { inline_keyboard: [] },
      }));
    }
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
    if (rendered.media === undefined) {
      return api.sendMessage(instance.chatId, rendered.text || "\u2063", {
        parse_mode: rendered.parseMode,
        reply_markup: rendered.replyMarkup,
        ...this.threadOptions(instance),
      });
    }
    const options = {
        caption: rendered.text || undefined,
        parse_mode: rendered.parseMode,
        reply_markup: rendered.replyMarkup,
        ...this.threadOptions(instance),
    };
    switch (rendered.media.kind) {
      case "photo": return api.sendPhoto(instance.chatId, rendered.media.source, options);
      case "video": return api.sendVideo(instance.chatId, rendered.media.source, options);
      case "animation": return api.sendAnimation(instance.chatId, rendered.media.source, options);
      case "audio": return api.sendAudio(instance.chatId, rendered.media.source, options);
      case "document": return api.sendDocument(instance.chatId, rendered.media.source, options);
      case "voice": return api.sendVoice(instance.chatId, rendered.media.source, options);
    }
  }

  private async edit(
    api: Api,
    surface: SurfaceReference,
    rendered: RenderedWindow,
  ): Promise<void> {
    if (surface.kind === "text" && rendered.media === undefined) {
      await api.editMessageText(surface.chatId, surface.messageId, rendered.text || "\u2063", {
        parse_mode: rendered.parseMode,
        reply_markup: rendered.replyMarkup,
      });
      return;
    }
    if (surface.kind !== "text" && surface.kind !== "voice" &&
      rendered.media !== undefined && rendered.media.kind !== "voice") {
      await api.editMessageMedia(
        surface.chatId,
        surface.messageId,
        this.inputMedia(rendered.media, rendered.text, rendered.parseMode),
        { reply_markup: rendered.replyMarkup },
      );
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
      kind: rendered.media?.kind ?? "text",
      hasKeyboard: rendered.replyMarkup !== undefined,
    };
  }

  private threadOptions(instance: InstanceRecord): { message_thread_id?: number } {
    return instance.threadId === undefined ? {} : { message_thread_id: instance.threadId };
  }

  private inputMedia(media: RenderedMedia, text: string, parseMode?: ParseMode): InputMedia {
    return {
      type: media.kind,
      media: media.source,
      caption: text || undefined,
      parse_mode: parseMode,
    } as InputMedia;
  }

  private async ignoreFailure(operation: () => Promise<unknown>): Promise<void> {
    try {
      await operation();
    } catch {
      // Compensation is best effort; the original error remains authoritative.
    }
  }
}
