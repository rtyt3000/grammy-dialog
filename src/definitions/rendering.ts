import type { Context } from "grammy";
import type { Awaitable } from "./common.js";
import type { Translation } from "./i18n.js";

/** Values available while rendering text, media, keyboards, and widgets. */
export interface RenderContext<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> {
  /** The incoming grammY context, absent for background renders. */
  readonly ctx: C | undefined;
  /** The value returned by the current ViewModel loader. */
  readonly vm: View;
  /** Application services supplied to `dialogs()`. */
  readonly services: Services;
  /** Locale stored on the dialog instance. */
  readonly locale: string;
  /** Resolves a translation using the instance locale. */
  readonly t: (
    key: string,
    params?: Record<string, unknown>,
  ) => Awaitable<string>;
}

/** Static text, a deferred translation, or a render function. */
export type TextSource<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> =
  | string
  | Translation
  | ((context: RenderContext<C, View, Services>) => Awaitable<string | Translation>);
