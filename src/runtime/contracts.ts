import type { Api, Context, StorageAdapter } from "grammy";
import type {
  AccessStrategy,
  DialogDefinition,
  DialogResource,
  LocaleResolver,
  ScopeStrategy,
  TranslationAdapter,
  WindowDefinition,
} from "../core.js";
import type { CallbackCodec, CallbackCodecOptions } from "../callbacks/codec.js";
import type { InputRoutingStrategy } from "../input-routing/contracts.js";
import type { DialogStorageRecord } from "../persistence/storage.js";
import type { CloseStrategy, PresentationStrategy } from "../presentation/contracts.js";

export interface DialogRuntimeOptions<C extends Context = Context, Services = unknown> {
  list: ReadonlyArray<DialogResource<C>>;
  storage?: StorageAdapter<DialogStorageRecord>;
  services?: Services;
  callbacks?: CallbackCodecOptions | CallbackCodec;
  i18n?: {
    adapter: TranslationAdapter;
    locale?: LocaleResolver<C>;
  };
  defaultLocale?: string;
  callbackTtlMs?: number;
  defaults?: {
    scope?: ScopeStrategy<C>;
    access?: AccessStrategy<C>;
    presentation?: PresentationStrategy;
    close?: CloseStrategy;
    inputRouting?: InputRoutingStrategy<C>;
  };
}

export interface StartOptions {
  data?: unknown;
  locale?: string;
}

export interface ShowOptions extends StartOptions {
  chatId?: number;
  actorId?: number;
  threadId?: number;
  api?: Api;
}

export interface InstanceHandle {
  readonly id: string;
}

export interface DialogController {
  start(dialog: string | DialogDefinition, options?: StartOptions): Promise<InstanceHandle>;
  setLocale(instanceId: string, locale: string): Promise<void>;
}

export interface UiController {
  show(window: string | WindowDefinition, options?: ShowOptions): Promise<InstanceHandle>;
}

export interface DialogFlavor {
  dialog: DialogController;
  ui: UiController;
}
