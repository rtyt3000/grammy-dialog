import type { Context } from "grammy";
import type {
  InputDefinition,
  TextSource,
} from "./core.js";

export interface MatchedInput {
  intent: string;
  value?: unknown;
  failure?: TextSource;
}

export class InputMatcher<C extends Context = Context> {
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

    if (input.kind === "custom" && await input.match(ctx)) {
      const value = await input.parse(ctx);
      const validation = await input.validate?.(value) ?? { ok: true as const, value };
      return validation.ok
        ? { intent: input.onReceive, value: validation.value }
        : { intent: input.onReceive, failure: validation.message ?? "Invalid value" };
    }

    return undefined;
  }
}
