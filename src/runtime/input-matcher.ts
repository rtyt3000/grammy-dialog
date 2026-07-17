import type { Context } from "grammy";
import type {
  InputDefinition,
  TextSource,
} from "../core.js";

/** Intent dispatch or validation failure produced by input matching. */
export interface MatchedInput {
  intent: string;
  value?: unknown;
  failure?: TextSource;
}

/** Matches grammY messages against built-in and custom input definitions. */
export class InputMatcher<C extends Context = Context> {
  /** Returns the first matching normalized input, or `undefined`. */
  public async match(
    ctx: C,
    inputs: ReadonlyArray<InputDefinition<C>>,
  ): Promise<MatchedInput | undefined> {
    for (const input of inputs) {
      const matched = await this.matchOne(ctx, input);
      if (matched !== undefined) return matched;
    }
    return undefined;
  }

  private async matchOne(
    ctx: C,
    input: InputDefinition<C>,
  ): Promise<MatchedInput | undefined> {
    if (input.kind === "text" && ctx.message?.text !== undefined) {
      const value = input.trim ? ctx.message.text.trim() : ctx.message.text;
      const validation = await input.validate?.(value) ?? { ok: true as const, value };
      return validation.ok
        ? { intent: input.onReceive, value: validation.value }
        : { intent: input.onReceive, failure: validation.message ?? "Invalid value" };
    }

    if (input.kind === "photo" && ctx.message?.photo !== undefined) {
      const selected = ctx.message.photo[ctx.message.photo.length - 1];
      if (selected === undefined) return undefined;
      return {
        intent: input.onReceive,
        value: {
          fileId: selected.file_id,
          fileUniqueId: selected.file_unique_id,
          width: selected.width,
          height: selected.height,
          fileSize: selected.file_size,
          caption: ctx.message.caption,
          messageId: ctx.message.message_id,
        },
      };
    }

    if (input.kind === "video" && ctx.message?.video !== undefined) {
      const value = ctx.message.video;
      return { intent: input.onReceive, value: {
        ...this.file(ctx, value),
        width: value.width,
        height: value.height,
        duration: value.duration,
      } };
    }

    if (input.kind === "animation" && ctx.message?.animation !== undefined) {
      const value = ctx.message.animation;
      return { intent: input.onReceive, value: {
        ...this.file(ctx, value),
        width: value.width,
        height: value.height,
        duration: value.duration,
      } };
    }

    if (input.kind === "audio" && ctx.message?.audio !== undefined) {
      const value = ctx.message.audio;
      return { intent: input.onReceive, value: {
        ...this.file(ctx, value),
        duration: value.duration,
        performer: value.performer,
        title: value.title,
      } };
    }

    if (input.kind === "document" && ctx.message?.document !== undefined) {
      return { intent: input.onReceive, value: this.file(ctx, ctx.message.document) };
    }

    if (input.kind === "voice" && ctx.message?.voice !== undefined) {
      const value = ctx.message.voice;
      return { intent: input.onReceive, value: {
        ...this.file(ctx, value),
        duration: value.duration,
      } };
    }

    if (input.kind === "sticker" && ctx.message?.sticker !== undefined) {
      const value = ctx.message.sticker;
      return { intent: input.onReceive, value: {
        ...this.file(ctx, value),
        width: value.width,
        height: value.height,
        emoji: value.emoji,
        setName: value.set_name,
        isAnimated: value.is_animated,
        isVideo: value.is_video,
      } };
    }

    if (input.kind === "contact" && ctx.message?.contact !== undefined) {
      const value = ctx.message.contact;
      return { intent: input.onReceive, value: {
        phoneNumber: value.phone_number,
        firstName: value.first_name,
        lastName: value.last_name,
        userId: value.user_id,
        vcard: value.vcard,
        messageId: ctx.message.message_id,
      } };
    }

    if (input.kind === "location" && ctx.message?.location !== undefined) {
      const value = ctx.message.location;
      return { intent: input.onReceive, value: {
        latitude: value.latitude,
        longitude: value.longitude,
        horizontalAccuracy: value.horizontal_accuracy,
        livePeriod: value.live_period,
        heading: value.heading,
        proximityAlertRadius: value.proximity_alert_radius,
        messageId: ctx.message.message_id,
      } };
    }

    if (input.kind === "message" && ctx.message !== undefined) {
      return { intent: input.onReceive, value: ctx.message };
    }

    if (input.kind === "custom" && await input.match(ctx)) {
      const value = await input.parse(ctx);
      const validation = await input.validate?.(value) ?? { ok: true as const, value };
      return validation.ok
        ? { intent: input.onReceive, value: validation.value }
        : { intent: input.onReceive, failure: validation.message ?? "Invalid value" };
    }

    return undefined;
  }

  private file(
    ctx: C,
    value: {
      file_id: string;
      file_unique_id: string;
      file_size?: number;
      file_name?: string;
      mime_type?: string;
    },
  ) {
    return {
      fileId: value.file_id,
      fileUniqueId: value.file_unique_id,
      fileSize: value.file_size,
      fileName: value.file_name,
      mimeType: value.mime_type,
      caption: ctx.message?.caption,
      messageId: ctx.message!.message_id,
    };
  }
}
