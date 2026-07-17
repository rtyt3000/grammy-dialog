import type { Context } from "grammy";
import type { Awaitable } from "../core.js";
import type { InstanceRecord } from "../persistence/storage.js";

export interface InputRouteCandidate {
  readonly id: string;
  readonly instance: Readonly<InstanceRecord>;
}

export interface InputRoutingContext<C extends Context = Context> {
  readonly ctx: C;
  readonly candidates: ReadonlyArray<InputRouteCandidate>;
}

export interface InputRoutingStrategy<C extends Context = Context> {
  readonly id: string;
  route(context: InputRoutingContext<C>): Awaitable<string | undefined>;
}
