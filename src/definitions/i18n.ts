import type { Context } from "grammy";
import type { Awaitable } from "./common.js";

export interface Translation {
  readonly kind: "translation";
  readonly key: string;
  readonly params?: Record<string, unknown>;
}

export function t(key: string, params?: Record<string, unknown>): Translation {
  return { kind: "translation", key, params };
}

export interface TranslationAdapter {
  translate(
    locale: string,
    key: string,
    params?: Record<string, unknown>,
  ): Awaitable<string>;
}

export interface LocaleResolver<C extends Context = Context> {
  resolve(ctx: C): Awaitable<string>;
}
