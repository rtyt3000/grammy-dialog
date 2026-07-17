import type { Context } from "grammy";
import type { Awaitable } from "./common.js";

export interface ScopeResolution {
  readonly key: string;
  readonly chatId: number;
  readonly threadId?: number;
}

export interface ScopeStrategy<C extends Context = Context> {
  readonly id: string;
  resolve(ctx: C): Awaitable<ScopeResolution>;
}

export interface AccessInstance {
  readonly id: string;
  readonly ownerId?: number;
  readonly chatId: number;
  readonly threadId?: number;
}

export interface AccessStrategy<C extends Context = Context> {
  readonly id: string;
  allows(ctx: C, instance: AccessInstance): Awaitable<boolean>;
}
