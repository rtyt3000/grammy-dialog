import type { Context } from "grammy";
import type { Awaitable } from "./common.js";
import type { Translation } from "./i18n.js";

export interface RenderContext<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> {
  readonly ctx: C | undefined;
  readonly vm: View;
  readonly services: Services;
  readonly locale: string;
  readonly t: (
    key: string,
    params?: Record<string, unknown>,
  ) => Awaitable<string>;
}

export type TextSource<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> =
  | string
  | Translation
  | ((context: RenderContext<C, View, Services>) => Awaitable<string | Translation>);
