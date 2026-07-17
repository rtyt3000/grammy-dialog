import type { Context } from "grammy";
import type { Awaitable } from "./common.js";

/** A deferred translation resolved with the locale stored by the dialog instance. */
export interface Translation {
  readonly kind: "translation";
  readonly key: string;
  readonly params?: Record<string, unknown>;
}

/** Creates a deferred translation value for window text or button labels. */
export function t(key: string, params?: Record<string, unknown>): Translation {
  return { kind: "translation", key, params };
}

/** Adapter implemented by an arbitrary application i18n system. */
export interface TranslationAdapter {
  /** Resolves a translation key for the requested locale. */
  translate(
    locale: string,
    key: string,
    params?: Record<string, unknown>,
  ): Awaitable<string>;
}

/** Resolves the initial locale when an instance is created from an update. */
export interface LocaleResolver<C extends Context = Context> {
  /** Returns a locale identifier such as `en` or `pl`. */
  resolve(ctx: C): Awaitable<string>;
}
