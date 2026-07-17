import type {
  Api,
  Context,
} from "grammy";
import {
  type AccessStrategy,
  type DialogDefinition,
  type LocaleResolver,
  type ScopeStrategy,
  type WindowDefinition,
} from "../core.js";
import {
  createCallbackCodec,
  type CallbackCodec,
  type CallbackCodecOptions,
} from "../callbacks/codec.js";
import {
  type CallbackRecord,
  type DialogStorageRecord,
  type IdentityCoordinator,
  type InstanceRecord,
  MemoryStorageAdapter,
} from "../persistence/storage.js";
import { access, scopes } from "../policies/scope-access.js";
import { DefinitionRegistry, type AnyWindow } from "./definition-registry.js";
import { DialogRepository } from "../persistence/dialog-repository.js";
import { KeyedLocks } from "./keyed-locks.js";
import { WindowRenderer } from "./window-renderer.js";
import { SurfaceManager } from "./surface-manager.js";
import { InputMatcher } from "./input-matcher.js";
import {
  closeStrategies,
  presentations,
} from "../presentation/strategies.js";
import { inputRouting } from "../input-routing/strategies.js";
import type { InputRoutingStrategy } from "../input-routing/contracts.js";
import { FocusManager } from "./focus-manager.js";
import { InstanceTransitions } from "./instance-transitions.js";
import { ActionExecutor } from "./action-executor.js";
import type {
  DialogController,
  DialogRuntimeOptions,
  InstanceHandle,
  ShowOptions,
  StartOptions,
  UiController,
} from "./contracts.js";

/**
 * Stateful orchestration engine behind the grammY middleware.
 * It may also be retained to show standalone windows outside incoming updates.
 */
export class DialogRuntime<
  C extends Context = Context,
  Services = unknown,
> {
  private readonly registry: DefinitionRegistry<C>;
  private readonly repository: DialogRepository;
  private readonly services: Services;
  private readonly codec: CallbackCodec;
  private readonly renderer: WindowRenderer<C, Services>;
  private readonly surfaces: SurfaceManager<C, Services>;
  private readonly inputs = new InputMatcher<C>();
  private readonly localeResolver?: LocaleResolver<C>;
  private readonly defaultLocale: string;
  private readonly defaultScope: ScopeStrategy<C>;
  private readonly defaultAccess: AccessStrategy<C>;
  private readonly inputRouting: InputRoutingStrategy<C>;
  private readonly locks = new KeyedLocks();
  private readonly focus: FocusManager;
  private readonly transitions: InstanceTransitions;
  private readonly actions: ActionExecutor<C, Services>;
  private readonly identities?: IdentityCoordinator;

  /** Creates a runtime and normalizes all storage, codec, locale, and policy defaults. */
  public constructor(options: DialogRuntimeOptions<C, Services>) {
    const storage = options.storage ?? new MemoryStorageAdapter<DialogStorageRecord>();
    this.identities = options.identities ?? this.storageIdentityCoordinator(storage);
    this.repository = new DialogRepository(storage);
    this.focus = new FocusManager(this.repository);
    this.registry = new DefinitionRegistry(options.list);
    this.transitions = new InstanceTransitions(this.registry, options.maxStackDepth ?? 32);
    this.services = options.services as Services;
    this.codec = "encode" in (options.callbacks ?? {})
      ? options.callbacks as CallbackCodec
      : createCallbackCodec(options.callbacks as CallbackCodecOptions | undefined);
    this.localeResolver = options.i18n?.locale;
    this.defaultLocale = options.defaultLocale ?? "en";
    this.renderer = new WindowRenderer({
      registry: this.registry,
      repository: this.repository,
      services: this.services,
      codec: this.codec,
      translator: options.i18n?.adapter,
      callbackTtlMs: options.callbackTtlMs ?? 7 * 24 * 60 * 60 * 1000,
    });
    this.actions = new ActionExecutor(
      this.registry,
      this.renderer,
      this.services,
      this.transitions,
    );
    this.surfaces = new SurfaceManager(
      this.renderer,
      this.repository,
      options.defaults?.presentation ?? presentations.auto(),
      options.defaults?.close ?? closeStrategies.detach(),
    );
    this.defaultScope = options.defaults?.scope ?? scopes.member<C>();
    this.defaultAccess = options.defaults?.access ?? access.owner<C>();
    this.inputRouting = options.defaults?.inputRouting ?? inputRouting.replyOrFocused<C>();
  }

  /** Creates the `ctx.dialog` controller bound to an incoming update. */
  public controller(ctx: C): DialogController {
    return {
      start: (dialog, options) => this.start(ctx, dialog, options),
      setLocale: (instanceId, locale) => this.setLocale(ctx.api, instanceId, locale, ctx),
    };
  }

  /** Creates the `ctx.ui` controller bound to an incoming update. */
  public uiController(ctx: C): UiController {
    return {
      show: (window, options) => this.show(window, {
        ...options,
        api: options?.api ?? ctx.api,
        chatId: options?.chatId ?? ctx.chat?.id,
        actorId: options?.actorId ?? ctx.from?.id,
        threadId: options?.threadId ?? this.messageThreadId(ctx),
      }, ctx),
    };
  }

  /** Resolves scope and locale, persists, and mounts a new dialog instance. */
  public async start(
    ctx: C,
    dialogReference: string | DialogDefinition<any, any, any, any>,
    options: StartOptions = {},
  ): Promise<InstanceHandle> {
    if (ctx.chat === undefined) throw new Error("Cannot start a dialog without a chat");
    const dialog = this.registry.dialog(dialogReference);
    const initial = this.registry.window(this.registry.resolveDialogWindow(dialog, dialog.initial));
    const scope = await (dialog.scope ?? this.defaultScope).resolve(ctx);
    const locale = options.locale ?? await this.resolveLocale(ctx);
    const instance = this.createInstance({
      kind: "dialog",
      definitionId: dialog.id,
      windowId: initial.id,
      chatId: scope.chatId,
      threadId: scope.threadId,
      scopeKey: scope.key,
      key: options.key,
      ownerId: ctx.from?.id,
      locale,
      data: options.data,
      state: dialog.viewModel.initialState(),
    });

    return this.mountWithIdentity(instance, options.mode ?? "create", ctx.api, ctx);
  }

  /** Persists and mounts an independent standalone-window instance. */
  public async show(
    windowReference: string | WindowDefinition<any, any, any, any>,
    options: ShowOptions,
    ctx?: C,
  ): Promise<InstanceHandle> {
    if (options.api === undefined) throw new Error("ui.show requires an Api instance");
    if (options.chatId === undefined) throw new Error("ui.show requires a chatId");
    const selectedWindow = this.registry.window(windowReference);
    const locale = options.locale ?? (ctx === undefined ? this.defaultLocale : await this.resolveLocale(ctx));
    const instance = this.createInstance({
      kind: "standalone",
      definitionId: selectedWindow.id,
      windowId: selectedWindow.id,
      chatId: options.chatId,
      threadId: options.threadId,
      scopeKey: options.threadId === undefined
        ? String(options.chatId)
        : `${options.chatId}:${options.threadId}`,
      key: options.key,
      ownerId: options.actorId,
      locale,
      data: options.data,
      state: selectedWindow.viewModel.initialState(),
    });

    return this.mountWithIdentity(instance, options.mode ?? "create", options.api, ctx);
  }

  /** Handles a callback owned by this runtime and reports whether it was consumed. */
  public async handleCallback(ctx: C): Promise<boolean> {
    const data = ctx.callbackQuery?.data;
    if (data === undefined) return false;
    const token = this.codec.decode(data);
    if (token === undefined) return false;

    const callback = await this.repository.readCallback(token);
    if (callback === undefined) {
      await ctx.answerCallbackQuery({ text: "This button is no longer active." });
      return true;
    }

    await ctx.answerCallbackQuery();
    await this.locks.run(callback.instanceId, async () => {
      await this.processAction(ctx, callback);
    });
    return true;
  }

  /** Routes an input to one focused instance and reports whether it was consumed. */
  public async handleInput(ctx: C): Promise<boolean> {
    if (ctx.chat === undefined || ctx.from === undefined || ctx.message === undefined) return false;
    const focusedInstanceIds = await this.repository.readFocusIds(
      ctx.chat.id,
      ctx.from.id,
      this.messageThreadId(ctx),
    );
    const candidates = (await Promise.all(
      focusedInstanceIds.map(id => this.repository.readInstance(id)),
    )).filter((instance): instance is InstanceRecord =>
      instance !== undefined && instance.status === "active"
    ).map(instance => ({ id: instance.id, instance }));
    const focusedInstanceId = await this.inputRouting.route({ ctx, candidates });
    if (focusedInstanceId === undefined) return false;
    if (!candidates.some(candidate => candidate.id === focusedInstanceId)) return false;

    return this.locks.run(focusedInstanceId, async () => {
      const instance = await this.repository.readInstance(focusedInstanceId);
      if (instance === undefined || instance.status !== "active") return false;
      const selectedWindow = this.registry.currentWindow(instance);
      if (!await this.canAccess(ctx, instance, selectedWindow)) return false;
      const matched = await this.inputs.match(ctx, selectedWindow.input ?? []);
      if (matched === undefined) return false;

      if (matched.failure !== undefined) {
        const renderContext = await this.renderer.createContext(instance, selectedWindow, ctx);
        await ctx.reply(await this.renderer.resolveText(matched.failure, renderContext));
        return true;
      }

      await this.actions.intent(
        ctx,
        instance,
        selectedWindow,
        matched.intent,
        undefined,
        matched.value,
      );
      await this.finishUpdate(ctx.api, instance, ctx);
      return true;
    });
  }

  /** Changes an active instance locale and immediately rerenders its current window. */
  public async setLocale(api: Api, instanceId: string, locale: string, ctx?: C): Promise<void> {
    await this.locks.run(instanceId, async () => {
      const instance = await this.repository.readInstance(instanceId);
      if (instance === undefined || instance.status !== "active") {
        throw new Error(`Active instance not found: ${instanceId}`);
      }
      instance.locale = locale;
      instance.revision += 1;
      await this.surfaces.rerender(api, instance, ctx);
    });
  }

  private createInstance(options: {
    kind: InstanceRecord["kind"];
    definitionId: string;
    windowId: string;
    chatId: number;
    ownerId?: number;
    threadId?: number;
    scopeKey: string;
    key?: string;
    locale: string;
    data?: unknown;
    state: unknown;
  }): InstanceRecord {
    return {
      id: crypto.randomUUID(),
      kind: options.kind,
      definitionId: options.definitionId,
      ownerId: options.ownerId,
      chatId: options.chatId,
      threadId: options.threadId,
      scopeKey: options.scopeKey,
      key: options.key,
      stack: [{ windowId: options.windowId, data: options.data }],
      state: options.state,
      locale: options.locale,
      revision: 0,
      status: "active",
      callbackTokens: [],
      widgetStates: {},
      focusedUserIds: [],
    };
  }

  private async mountWithIdentity(
    instance: InstanceRecord,
    mode: "create" | "reuse" | "replace",
    api: Api,
    ctx?: C,
  ): Promise<InstanceHandle> {
    if (instance.key === undefined) {
      await this.focus.commit(instance, instance.ownerId, () =>
        this.surfaces.mount(api, instance, ctx)
      );
      return { id: instance.id };
    }

    const identities = this.identities;
    if (identities === undefined) {
      throw new Error(
        "Keyed instances require a distributed identity coordinator in middleware options",
      );
    }
    const lockKey = `identity:${instance.scopeKey}:${instance.definitionId}:${instance.key}`;
    return identities.run(lockKey, async () => {
      const existingId = await this.repository.readIdentity(
        instance.scopeKey,
        instance.definitionId,
        instance.key!,
      );
      const existing = existingId === undefined
        ? undefined
        : await this.repository.readInstance(existingId);
      const active = existing?.status === "active" ? existing : undefined;

      if (active !== undefined && mode === "create") {
        throw new Error(
          `Active instance already exists for key '${instance.key}' in scope '${instance.scopeKey}'`,
        );
      }
      if (active !== undefined && mode === "reuse") {
        await this.locks.run(active.id, async () => {
          const current = await this.repository.readInstance(active.id);
          if (current === undefined || current.status !== "active") {
            throw new Error(`Keyed instance '${active.id}' became inactive during reuse`);
          }
          const selectedWindow = this.registry.currentWindow(current);
          if (ctx !== undefined && !await this.canAccess(ctx, current, selectedWindow)) {
            throw new Error(`Access denied for existing instance '${current.id}'`);
          }
          current.revision += 1;
          await this.focus.commit(current, ctx?.from?.id ?? instance.ownerId, () =>
            this.surfaces.rerender(api, current, ctx)
          );
        });
        return { id: active.id };
      }
      if (active !== undefined) {
        await this.locks.run(active.id, async () => {
          const current = await this.repository.readInstance(active.id);
          if (current === undefined || current.status !== "active") return;
          this.transitions.controller(current).close();
          await this.finishUpdate(api, current, ctx);
        });
      }

      await this.repository.writeIdentity(
        instance.scopeKey,
        instance.definitionId,
        instance.key!,
        instance.id,
      );
      try {
        await this.focus.commit(instance, instance.ownerId, () =>
          this.surfaces.mount(api, instance, ctx)
        );
      } catch (error) {
        await this.repository.deleteIdentityIfOwned(
          instance.scopeKey,
          instance.definitionId,
          instance.key!,
          instance.id,
        );
        throw error;
      }
      return { id: instance.id };
    });
  }

  private async processAction(ctx: C, callback: CallbackRecord): Promise<void> {
    const instance = await this.repository.readInstance(callback.instanceId);
    if (instance === undefined || instance.status !== "active") return;
    if (callback.expiresAt !== undefined && callback.expiresAt < Date.now()) return;
    if (callback.revision !== instance.revision) return;
    if (callback.chatId !== ctx.chat?.id) return;
    if (instance.surface?.messageId !== ctx.callbackQuery?.message?.message_id) return;

    const selectedWindow = this.registry.currentWindow(instance);
    if (!await this.canAccess(ctx, instance, selectedWindow)) return;
    await this.actions.execute(ctx, instance, selectedWindow, callback.action);
    if (instance.status === "active") {
      await this.focus.commit(instance, ctx.from?.id, () =>
        this.finishUpdate(ctx.api, instance, ctx)
      );
    } else {
      await this.finishUpdate(ctx.api, instance, ctx);
    }
  }

  private async finishUpdate(api: Api, instance: InstanceRecord, ctx?: C): Promise<void> {
    instance.revision += 1;
    if (instance.status === "closed") {
      const surface = instance.surface;
      const operation = await this.surfaces.planClose(instance);
      const oldTokens = instance.callbackTokens;
      const focusedUserIds = instance.focusedUserIds;
      instance.callbackTokens = [];
      instance.focusedUserIds = [];
      if (operation === "detach" && instance.surface !== undefined) {
        instance.surface.hasKeyboard = false;
      } else if (operation === "delete") {
        instance.surface = undefined;
      }
      await this.repository.writeInstance(instance);
      await Promise.allSettled([
        this.surfaces.applyClose(api, surface, operation),
        this.repository.deleteCallbacks(oldTokens),
        ...focusedUserIds.map(userId => this.repository.deleteFocusIfOwned(
          instance.chatId,
          userId,
          instance.id,
          instance.threadId,
        )),
      ]);
      return;
    }
    await this.surfaces.rerender(api, instance, ctx);
  }

  private async resolveLocale(ctx: C): Promise<string> {
    return this.localeResolver?.resolve(ctx) ?? this.defaultLocale;
  }

  private storageIdentityCoordinator(
    storage: object,
  ): IdentityCoordinator | undefined {
    if (!("identities" in storage)) return undefined;
    const identities = (storage as { identities?: unknown }).identities;
    return typeof identities === "object" && identities !== null && "run" in identities
      ? identities as IdentityCoordinator
      : undefined;
  }

  private messageThreadId(ctx: C): number | undefined {
    return (ctx.msg as { message_thread_id?: number } | undefined)?.message_thread_id;
  }

  private async canAccess(
    ctx: C,
    instance: InstanceRecord,
    selectedWindow: AnyWindow<C>,
  ): Promise<boolean> {
    const dialog = instance.kind === "dialog"
      ? this.registry.findDialog(instance.definitionId)
      : undefined;
    const strategy = selectedWindow.access ?? dialog?.access ?? this.defaultAccess;
    return strategy.allows(ctx, instance);
  }

}
