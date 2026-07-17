import type { Context } from "grammy";
import type { Awaitable } from "../core.js";
import type { InstanceRecord } from "../persistence/storage.js";

/** Active focused instance considered for an incoming input update. */
export interface InputRouteCandidate {
  readonly id: string;
  readonly instance: Readonly<InstanceRecord>;
}

/** Values passed to an input routing strategy. */
export interface InputRoutingContext<C extends Context = Context> {
  readonly ctx: C;
  readonly candidates: ReadonlyArray<InputRouteCandidate>;
}

/** Selects at most one focused instance for an incoming update. */
export interface InputRoutingStrategy<C extends Context = Context> {
  readonly id: string;
  route(context: InputRoutingContext<C>): Awaitable<string | undefined>;
}
