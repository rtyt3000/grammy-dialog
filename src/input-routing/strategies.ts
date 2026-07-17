import type { Context } from "grammy";
import type { InputRoutingStrategy } from "./contracts.js";

/** Factories for built-in and application-defined input routing strategies. */
export interface InputRoutingStrategies {
  /** Routes to the most recently focused instance. */
  latest<C extends Context = Context>(): InputRoutingStrategy<C>;
  /** Routes to the earliest still-focused instance. */
  oldest<C extends Context = Context>(): InputRoutingStrategy<C>;
  /** Routes only when exactly one focused instance can receive the input. */
  focused<C extends Context = Context>(): InputRoutingStrategy<C>;
  /** Routes only by an explicit reply to an instance surface. */
  reply<C extends Context = Context>(): InputRoutingStrategy<C>;
  /** Routes by reply, or by focus when the candidate is unambiguous. */
  replyOrFocused<C extends Context = Context>(): InputRoutingStrategy<C>;
  /** Routes by replied-to surface, then applies the configured fallback. */
  replyWithFallback<C extends Context = Context>(options?: {
    fallback?: "latest" | "oldest" | "none";
  }): InputRoutingStrategy<C>;
  /** Uses an application-defined routing strategy. */
  custom<C extends Context = Context>(strategy: InputRoutingStrategy<C>): InputRoutingStrategy<C>;
}

/** Built-in focused-input routing strategies. */
export const inputRouting: InputRoutingStrategies = {
  latest: () => ({
    id: "latest",
    route: ({ candidates }) => candidates.at(-1)?.id,
  }),
  oldest: () => ({
    id: "oldest",
    route: ({ candidates }) => candidates[0]?.id,
  }),
  focused: () => ({
    id: "focused",
    route: ({ candidates }) => candidates.length === 1 ? candidates[0]?.id : undefined,
  }),
  replyOrFocused: () => ({
    id: "reply-or-focused",
    route: ({ ctx, candidates }) => {
      const repliedMessageId = ctx.message?.reply_to_message?.message_id;
      const replied = repliedMessageId === undefined
        ? undefined
        : candidates.find(candidate => candidate.instance.surface?.messageId === repliedMessageId);
      if (replied !== undefined) return replied.id;
      return candidates.length === 1 ? candidates[0]?.id : undefined;
    },
  }),
  reply: () => ({
    id: "reply",
    route: ({ ctx, candidates }) => {
      const repliedMessageId = ctx.message?.reply_to_message?.message_id;
      const replied = repliedMessageId === undefined
        ? undefined
        : candidates.find(candidate => candidate.instance.surface?.messageId === repliedMessageId);
      return replied?.id;
    },
  }),
  replyWithFallback: (options = {}) => ({
    id: "reply-with-fallback",
    route: ({ ctx, candidates }) => {
      const repliedMessageId = ctx.message?.reply_to_message?.message_id;
      const replied = repliedMessageId === undefined
        ? undefined
        : candidates.find(candidate => candidate.instance.surface?.messageId === repliedMessageId);
      if (replied !== undefined) return replied.id;
      switch (options.fallback ?? "latest") {
        case "latest": return candidates.at(-1)?.id;
        case "oldest": return candidates[0]?.id;
        case "none": return undefined;
      }
    },
  }),
  custom: strategy => strategy,
};
