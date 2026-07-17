import type {
  Api,
  Context,
} from "grammy";
import {
  type AccessStrategy,
  type Awaitable,
  type ButtonAction,
  type DialogDefinition,
  type LocaleResolver,
  type NavigationController,
  type ScopeStrategy,
  StateHandle,
  type TranslationAdapter,
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
import { PresentationPlanner } from "../presentation/planner.js";
import {
  closeStrategies,
  presentations,
} from "../presentation/strategies.js";
import type {
  CloseStrategy,
  PresentationStrategy,
} from "../presentation/contracts.js";
import { inputRouting } from "../input-routing/strategies.js";
import type { InputRoutingStrategy } from "../input-routing/contracts.js";
import { FocusManager } from "./focus-manager.js";
import type {
  DialogController,
  DialogFlavor,
  DialogRuntimeOptions,
  InstanceHandle,
  ShowOptions,
  StartOptions,
  UiController,
} from "./contracts.js";

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

  public constructor(options: DialogRuntimeOptions<C, Services>) {
    const storage = options.storage ?? new MemoryStorageAdapter<DialogStorageRecord>();
    this.repository = new DialogRepository(storage);
    this.focus = new FocusManager(this.repository);
    this.registry = new DefinitionRegistry(options.list);
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
    this.surfaces = new SurfaceManager(
      this.renderer,
      this.repository,
      new PresentationPlanner(options.defaults?.presentation ?? presentations.auto()),
      options.defaults?.close ?? closeStrategies.detach(),
    );
    this.defaultScope = options.defaults?.scope ?? scopes.member<C>();
    this.defaultAccess = options.defaults?.access ?? access.owner<C>();
    this.inputRouting = options.defaults?.inputRouting ?? inputRouting.latest<C>();
  }

  public controller(ctx: C): DialogController {
    return {
      start: (dialog, options) => this.start(ctx, dialog, options),
      setLocale: (instanceId, locale) => this.setLocale(ctx.api, instanceId, locale, ctx),
    };
  }

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

  public async start(
    ctx: C,
    dialogReference: string | DialogDefinition,
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
      ownerId: ctx.from?.id,
      locale,
      data: options.data,
      state: initial.viewModel.initialState(),
    });

    await this.focus.commit(instance, instance.ownerId, () =>
      this.surfaces.mount(ctx.api, instance, ctx)
    );
    return { id: instance.id };
  }

  public async show(
    windowReference: string | WindowDefinition,
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
      ownerId: options.actorId,
      locale,
      data: options.data,
      state: selectedWindow.viewModel.initialState(),
    });

    await this.focus.commit(instance, instance.ownerId, () =>
      this.surfaces.mount(options.api!, instance, ctx)
    );
    return { id: instance.id };
  }

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

      await this.executeIntent(ctx, instance, selectedWindow, matched.intent, undefined, matched.value);
      await this.finishUpdate(ctx.api, instance, ctx);
      return true;
    });
  }

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

  private async processAction(ctx: C, callback: CallbackRecord): Promise<void> {
    const instance = await this.repository.readInstance(callback.instanceId);
    if (instance === undefined || instance.status !== "active") return;
    if (callback.expiresAt !== undefined && callback.expiresAt < Date.now()) return;
    if (callback.revision !== instance.revision) return;
    if (callback.chatId !== ctx.chat?.id) return;
    if (callback.allowedUserId !== undefined && callback.allowedUserId !== ctx.from?.id) return;
    if (instance.surface?.messageId !== ctx.callbackQuery?.message?.message_id) return;

    const selectedWindow = this.registry.currentWindow(instance);
    if (!await this.canAccess(ctx, instance, selectedWindow)) return;
    if (callback.action.kind === "intent") {
      await this.executeIntent(
        ctx,
        instance,
        selectedWindow,
        callback.action.name,
        callback.action.payload,
        undefined,
      );
    } else if (callback.action.kind === "widget") {
      await this.executeWidgetAction(ctx, instance, selectedWindow, callback.action);
    } else {
      this.applyNavigation(instance, callback.action);
    }
    if (instance.status === "active") {
      await this.focus.commit(instance, ctx.from?.id, () =>
        this.finishUpdate(ctx.api, instance, ctx)
      );
    } else {
      await this.finishUpdate(ctx.api, instance, ctx);
    }
  }

  private async executeIntent(
    ctx: C,
    instance: InstanceRecord,
    selectedWindow: AnyWindow<C>,
    name: string,
    payload: unknown,
    value: unknown,
  ): Promise<void> {
    const handler = selectedWindow.viewModel.intents[name];
    if (handler === undefined) throw new Error(`Unknown intent '${name}' in window '${selectedWindow.id}'`);
    const state = this.stateHandle(instance);
    const vm = await selectedWindow.viewModel.load({
      ctx,
      state: state.value,
      services: this.services,
      actor: { id: ctx.from?.id, chatId: instance.chatId },
    });
    await handler({
      ctx,
      state,
      vm,
      services: this.services,
      navigation: this.navigation(instance),
      payload,
      value,
    });
  }

  private applyNavigation(instance: InstanceRecord, action: ButtonAction): void {
    if (action.kind === "intent" || action.kind === "widget") return;
    const navigation = this.navigation(instance);
    switch (action.kind) {
      case "go": navigation.go(action.windowId, action.data); break;
      case "replace": navigation.replace(action.windowId, action.data); break;
      case "back": navigation.back(); break;
      case "reset": navigation.reset(action.windowId, action.data); break;
      case "close": navigation.close(action.result); break;
    }
  }

  private navigation(instance: InstanceRecord): NavigationController {
    return {
      go: (windowId, data) => {
        const resolved = this.registry.resolveForInstance(instance, windowId);
        this.registry.window(resolved);
        instance.stack.push({ windowId: resolved, data });
      },
      replace: (windowId, data) => {
        const resolved = this.registry.resolveForInstance(instance, windowId);
        this.registry.window(resolved);
        instance.stack[instance.stack.length - 1] = { windowId: resolved, data };
      },
      back: () => {
        if (instance.stack.length > 1) instance.stack.pop();
        else instance.status = "closed";
      },
      reset: (windowId, data) => {
        const resolved = this.registry.resolveForInstance(instance, windowId);
        this.registry.window(resolved);
        instance.stack = [{ windowId: resolved, data }];
      },
      close: result => {
        instance.status = "closed";
        instance.result = result;
      },
    };
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

  private async executeWidgetAction(
    ctx: C,
    instance: InstanceRecord,
    selectedWindow: AnyWindow<C>,
    action: Extract<ButtonAction, { kind: "widget" }>,
  ): Promise<void> {
    if (selectedWindow.keyboard === undefined) {
      throw new Error(`Widget '${action.widgetId}' is not present in window '${selectedWindow.id}'`);
    }
    const renderContext = await this.renderer.createContext(instance, selectedWindow, ctx);
    const node = typeof selectedWindow.keyboard === "function"
      ? await selectedWindow.keyboard(renderContext)
      : selectedWindow.keyboard;
    if (!this.renderer.isKeyboardWidget(node) || node.id !== action.widgetId) {
      throw new Error(`Widget '${action.widgetId}' is not present in window '${selectedWindow.id}'`);
    }
    const handler = node.definition.actions[action.action];
    if (handler === undefined) {
      throw new Error(`Unknown action '${action.action}' in widget '${action.widgetId}'`);
    }
    await handler({
      ctx,
      props: node.props,
      state: this.renderer.widgetState(instance, node),
      services: this.services,
      navigation: this.navigation(instance),
      payload: action.payload,
    });
  }

  private async resolveLocale(ctx: C): Promise<string> {
    return this.localeResolver?.resolve(ctx) ?? this.defaultLocale;
  }

  private stateHandle(instance: InstanceRecord): StateHandle<any> {
    return new StateHandle(instance.state, state => {
      instance.state = state;
    });
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
