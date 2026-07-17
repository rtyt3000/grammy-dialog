import type { Context } from "grammy";
import type { AccessStrategy, ScopeStrategy } from "../core.js";

function requireChat<C extends Context>(ctx: C): number {
  if (ctx.chat === undefined) throw new Error("A dialog scope requires a chat");
  return ctx.chat.id;
}

export interface ScopeStrategies {
  member<C extends Context = Context>(): ScopeStrategy<C>;
  chat<C extends Context = Context>(): ScopeStrategy<C>;
  topic<C extends Context = Context>(): ScopeStrategy<C>;
  custom<C extends Context = Context>(strategy: ScopeStrategy<C>): ScopeStrategy<C>;
}

export const scopes: ScopeStrategies = {
  member<C extends Context = Context>(): ScopeStrategy<C> {
    return {
      id: "member",
      resolve(ctx) {
        const chatId = requireChat(ctx);
        if (ctx.from === undefined) throw new Error("Member scope requires an actor");
        return { key: `${chatId}:${ctx.from.id}`, chatId };
      },
    };
  },

  chat<C extends Context = Context>(): ScopeStrategy<C> {
    return {
      id: "chat",
      resolve(ctx) {
        const chatId = requireChat(ctx);
        return { key: String(chatId), chatId };
      },
    };
  },

  topic<C extends Context = Context>(): ScopeStrategy<C> {
    return {
      id: "topic",
      resolve(ctx) {
        const chatId = requireChat(ctx);
        const threadId = (ctx.msg as { message_thread_id?: number } | undefined)?.message_thread_id;
        if (threadId === undefined) throw new Error("Topic scope requires a forum topic message");
        return { key: `${chatId}:${threadId}`, chatId, threadId };
      },
    };
  },

  custom<C extends Context = Context>(strategy: ScopeStrategy<C>): ScopeStrategy<C> {
    return strategy;
  },
};

export interface AccessStrategies {
  owner<C extends Context = Context>(): AccessStrategy<C>;
  everyone<C extends Context = Context>(): AccessStrategy<C>;
  custom<C extends Context = Context>(strategy: AccessStrategy<C>): AccessStrategy<C>;
}

export const access: AccessStrategies = {
  owner<C extends Context = Context>(): AccessStrategy<C> {
    return {
      id: "owner",
      allows(ctx, instance) {
        return instance.ownerId !== undefined && ctx.from?.id === instance.ownerId;
      },
    };
  },

  everyone<C extends Context = Context>(): AccessStrategy<C> {
    return {
      id: "everyone",
      allows(ctx, instance) {
        return ctx.chat?.id === instance.chatId;
      },
    };
  },

  custom<C extends Context = Context>(strategy: AccessStrategy<C>): AccessStrategy<C> {
    return strategy;
  },
};
