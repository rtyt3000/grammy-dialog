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
import type {
  CallbackCodec,
  CallbackCodecOptions,
} from "../callbacks/codec.js";
import type { InputRoutingStrategy } from "../input-routing/contracts.js";
import type {
  DialogStorageRecord,
  IdentityCoordinator,
} from "../persistence/storage.js";
import type {
  CloseStrategy,
  PresentationStrategy,
} from "../presentation/contracts.js";

/** Configuration accepted by `dialogs()` and `DialogRuntime`. */
export interface DialogRuntimeOptions<
  C extends Context = Context,
  Services = unknown,
> {
  /** Dialogs and standalone windows registered by this runtime. */
  list: ReadonlyArray<DialogResource<C>>;
  /** grammY storage adapter; defaults to an in-memory adapter. */
  storage?: StorageAdapter<DialogStorageRecord>;
  /**
   * Distributed coordinator required by keyed instances unless `storage`
   * exposes a shared `identities` coordinator itself.
   */
  identities?: IdentityCoordinator;
  /** Application dependencies exposed to ViewModels and renderers. */
  services?: Services;
  /** Built-in callback codec options or a complete custom codec. */
  callbacks?: CallbackCodecOptions | CallbackCodec;
  /** Optional translation adapter and initial locale resolver. */
  i18n?: {
    adapter: TranslationAdapter;
    locale?: LocaleResolver<C>;
  };
  /** Locale used when none can be resolved; defaults to `en`. */
  defaultLocale?: string;
  /** Callback record lifetime in milliseconds; defaults to seven days. */
  callbackTtlMs?: number;
  /** Maximum number of frames in one dialog stack; defaults to `32`. */
  maxStackDepth?: number;
  /** Runtime policy defaults overridden by dialog or window definitions. */
  defaults?: {
    scope?: ScopeStrategy<C>;
    access?: AccessStrategy<C>;
    presentation?: PresentationStrategy;
    close?: CloseStrategy;
    inputRouting?: InputRoutingStrategy<C>;
  };
}

/** Per-instance options accepted when starting a registered dialog. */
export interface StartOptions {
  data?: unknown;
  locale?: string;
  /** User-defined identity within the resolved scope and definition. */
  key?: string;
  /** Collision behavior when `key` already belongs to an active instance. */
  mode?: "create" | "reuse" | "replace";
}

/** Address and actor overrides for showing a standalone window. */
export interface ShowOptions extends StartOptions {
  chatId?: number;
  actorId?: number;
  threadId?: number;
  api?: Api;
}

/** Stable reference returned after a dialog instance is mounted. */
export interface InstanceHandle {
  readonly id: string;
}

/** Dialog operations installed on `ctx.dialog`. */
export interface DialogController {
  /** Starts and mounts a new dialog instance. */
  start(
    dialog: string | DialogDefinition<any, any, any, any>,
    options?: StartOptions,
  ): Promise<InstanceHandle>;
  /** Stores a locale and immediately rerenders the current window. */
  setLocale(instanceId: string, locale: string): Promise<void>;
}

/** Dialogless window operations installed on `ctx.ui`. */
export interface UiController {
  /** Creates and mounts an independent standalone-window instance. */
  show(
    window: string | WindowDefinition<any, any, any, any>,
    options?: ShowOptions,
  ): Promise<InstanceHandle>;
}

/** grammY context flavor installed by the dialog middleware. */
export interface DialogFlavor {
  dialog: DialogController;
  ui: UiController;
}
