import type { Context } from "grammy";
import type { InputRoutingStrategy } from "./contracts.js";

export interface InputRoutingStrategies {
  latest<C extends Context = Context>(): InputRoutingStrategy<C>;
  oldest<C extends Context = Context>(): InputRoutingStrategy<C>;
  reply<C extends Context = Context>(options?: {
    fallback?: "latest" | "oldest" | "none";
  }): InputRoutingStrategy<C>;
  custom<C extends Context = Context>(strategy: InputRoutingStrategy<C>): InputRoutingStrategy<C>;
}

export const inputRouting: InputRoutingStrategies = {
  latest: () => ({
    id: "latest",
    route: ({ candidates }) => candidates.at(-1)?.id,
  }),
  oldest: () => ({
    id: "oldest",
    route: ({ candidates }) => candidates[0]?.id,
  }),
  reply: (options = {}) => ({
    id: "reply",
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
