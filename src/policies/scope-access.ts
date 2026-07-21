import type { Context } from "grammy";
import type { AccessStrategy, ScopeStrategy } from "../core.js";

function requireChat<C extends Context>(ctx: C): number {
  if (ctx.chat === undefined) throw new Error("A dialog scope requires a chat");
  return ctx.chat.id;
}

/** Built-in factories for member, chat, topic, and custom scope strategies. */
export interface ScopeStrategies {
  /** Isolates instances by chat and user. This is the runtime default. */
  member<C extends Context = Context>(): ScopeStrategy<C>;
  /** Shares an instance scope across the entire chat. */
  chat<C extends Context = Context>(): ScopeStrategy<C>;
  /** Isolates instances by forum topic and rejects updates outside a topic. */
  topic<C extends Context = Context>(): ScopeStrategy<C>;
  /** Uses an application-defined scope resolver. */
  custom<C extends Context = Context>(
    strategy: ScopeStrategy<C> | ScopeStrategy<C>["resolve"],
  ): ScopeStrategy<C>;
}

/** Built-in dialog scope strategies. */
export const scopes: ScopeStrategies = {
  member<C extends Context = Context>(): ScopeStrategy<C> {
    return {
      id: "member",
      resolve(ctx) {
        const chatId = requireChat(ctx);
        if (ctx.from === undefined)
          throw new Error("Member scope requires an actor");
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
        const threadId = (ctx.msg as { message_thread_id?: number } | undefined)
          ?.message_thread_id;
        if (threadId === undefined)
          throw new Error("Topic scope requires a forum topic message");
        return { key: `${chatId}:${threadId}`, chatId, threadId };
      },
    };
  },

  custom<C extends Context = Context>(
    strategy: ScopeStrategy<C> | ScopeStrategy<C>["resolve"],
  ): ScopeStrategy<C> {
    return typeof strategy === "function"
      ? { id: "custom", resolve: strategy }
      : strategy;
  },
};

/** Built-in factories for owner, shared, and custom access strategies. */
export interface AccessStrategies {
  /** Allows only the instance creator. This is the runtime default. */
  owner<C extends Context = Context>(): AccessStrategy<C>;
  /** Allows every actor in the resolved scope. */
  everyone<C extends Context = Context>(): AccessStrategy<C>;
  /** Allows Telegram chat creators and administrators. */
  chatAdministrators<C extends Context = Context>(): AccessStrategy<C>;
  /** Uses an application-defined access predicate. */
  custom<C extends Context = Context>(
    strategy: AccessStrategy<C> | AccessStrategy<C>["allows"],
  ): AccessStrategy<C>;
}

/** Built-in instance access strategies. */
export const access: AccessStrategies = {
  owner<C extends Context = Context>(): AccessStrategy<C> {
    return {
      id: "owner",
      allows(ctx, instance) {
        return (
          instance.ownerId !== undefined && ctx.from?.id === instance.ownerId
        );
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

  chatAdministrators<C extends Context = Context>(): AccessStrategy<C> {
    return {
      id: "chat-administrators",
      async allows(ctx, instance) {
        if (ctx.chat?.id !== instance.chatId || ctx.from === undefined)
          return false;
        const member = await ctx.getChatMember(ctx.from.id);
        return member.status === "creator" || member.status === "administrator";
      },
    };
  },

  custom<C extends Context = Context>(
    strategy: AccessStrategy<C> | AccessStrategy<C>["allows"],
  ): AccessStrategy<C> {
    return typeof strategy === "function"
      ? { id: "custom", allows: strategy }
      : strategy;
  },
};
