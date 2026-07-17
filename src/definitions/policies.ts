import type { Context } from "grammy";
import type { Awaitable } from "./common.js";

/** Stable storage identity resolved for a dialog instance. */
export interface ScopeResolution {
  readonly key: string;
  readonly chatId: number;
  readonly threadId?: number;
}

/** Chooses how updates are grouped into independent dialog scopes. */
export interface ScopeStrategy<C extends Context = Context> {
  readonly id: string;
  resolve(ctx: C): Awaitable<ScopeResolution>;
}

/** Minimal instance information exposed to access policies. */
export interface AccessInstance {
  readonly id: string;
  readonly ownerId?: number;
  readonly chatId: number;
  readonly threadId?: number;
}

/** Decides whether the actor may interact with an existing instance. */
export interface AccessStrategy<C extends Context = Context> {
  readonly id: string;
  allows(ctx: C, instance: AccessInstance): Awaitable<boolean>;
}
