import type {
  Api,
  Context,
  InputFile,
  StorageAdapter,
} from "grammy";
import type { InlineKeyboardMarkup } from "grammy/types";
import {
  type AccessStrategy,
  type Awaitable,
  type ButtonAction,
  type DialogDefinition,
  type DialogResource,
  type InputDefinition,
  type KeyboardNode,
  type KeyboardWidgetInstance,
  type LocaleResolver,
  type NavigationController,
  type RenderContext,
  type ScopeStrategy,
  StateHandle,
  type TextSource,
  type Translation,
  type TranslationAdapter,
  type WindowDefinition,
} from "./core.js";
import {
  createCallbackCodec,
  type CallbackCodec,
  type CallbackCodecOptions,
} from "./callbacks.js";
import {
  type CallbackRecord,
  type DialogStorageRecord,
  type InstanceRecord,
  MemoryStorageAdapter,
  storageKeys,
} from "./storage.js";
import { access, scopes } from "./strategies.js";

type AnyWindow<C extends Context> = WindowDefinition<C, any, any, any>;

export interface DialogRuntimeOptions<
  C extends Context = Context,
  Services = unknown,
> {
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

interface RenderedWindow {
  text: string;
  photo?: string | InputFile;
  replyMarkup?: InlineKeyboardMarkup;
  callbackTokens: string[];
}

class InstanceLocks {
  private readonly locks = new Map<string, Promise<void>>();

  public async run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => {
      release = resolve;
    });
    this.locks.set(key, current);
    await previous;

    try {
      return await operation();
    } finally {
      release();
      if (this.locks.get(key) === current) this.locks.delete(key);
    }
  }
}

export class DialogRuntime<
  C extends Context = Context,
  Services = unknown,
> {
  private readonly dialogs = new Map<string, DialogDefinition<C>>();
  private readonly windows = new Map<string, AnyWindow<C>>();
  private readonly storage: StorageAdapter<DialogStorageRecord>;
  private readonly services: Services;
  private readonly codec: CallbackCodec;
  private readonly translator?: TranslationAdapter;
  private readonly localeResolver?: LocaleResolver<C>;
  private readonly defaultLocale: string;
  private readonly callbackTtlMs: number;
  private readonly defaultScope: ScopeStrategy<C>;
  private readonly defaultAccess: AccessStrategy<C>;
  private readonly locks = new InstanceLocks();

  public constructor(options: DialogRuntimeOptions<C, Services>) {
    this.storage = options.storage ?? new MemoryStorageAdapter<DialogStorageRecord>();
    this.services = options.services as Services;
    this.codec = "encode" in (options.callbacks ?? {})
      ? options.callbacks as CallbackCodec
      : createCallbackCodec(options.callbacks as CallbackCodecOptions | undefined);
    this.translator = options.i18n?.adapter;
    this.localeResolver = options.i18n?.locale;
    this.defaultLocale = options.defaultLocale ?? "en";
    this.callbackTtlMs = options.callbackTtlMs ?? 7 * 24 * 60 * 60 * 1000;
    this.defaultScope = options.defaults?.scope ?? scopes.member<C>();
    this.defaultAccess = options.defaults?.access ?? access.owner<C>();
    this.register(options.list);
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
    const dialog = typeof dialogReference === "string"
      ? this.dialogs.get(dialogReference)
      : this.dialogs.get(dialogReference.id);
    if (dialog === undefined) throw new Error(`Unknown dialog: ${typeof dialogReference === "string" ? dialogReference : dialogReference.id}`);
    const initial = this.requireWindow(this.resolveDialogWindow(dialog, dialog.initial));
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

    await this.mount(ctx.api, instance, ctx);
    await this.setFocus(instance);
    return { id: instance.id };
  }

  public async show(
    windowReference: string | WindowDefinition,
    options: ShowOptions,
    ctx?: C,
  ): Promise<InstanceHandle> {
    if (options.api === undefined) throw new Error("ui.show requires an Api instance");
    if (options.chatId === undefined) throw new Error("ui.show requires a chatId");
    const selectedWindow = typeof windowReference === "string"
      ? this.windows.get(windowReference)
      : this.windows.get(windowReference.id);
    if (selectedWindow === undefined) {
      throw new Error(`Unknown window: ${typeof windowReference === "string" ? windowReference : windowReference.id}`);
    }
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

    await this.mount(options.api, instance, ctx);
    await this.setFocus(instance);
    return { id: instance.id };
  }

  public async handleCallback(ctx: C): Promise<boolean> {
    const data = ctx.callbackQuery?.data;
    if (data === undefined) return false;
    const token = this.codec.decode(data);
    if (token === undefined) return false;

    const stored = await this.storage.read(storageKeys.callback(token));
    if (stored?.type !== "callback") {
      await ctx.answerCallbackQuery({ text: "This button is no longer active." });
      return true;
    }

    await ctx.answerCallbackQuery();
    await this.locks.run(stored.value.instanceId, async () => {
      await this.processAction(ctx, token, stored.value);
    });
    return true;
  }

  public async handleInput(ctx: C): Promise<boolean> {
    if (ctx.chat === undefined || ctx.from === undefined || ctx.message === undefined) return false;
    const focus = await this.storage.read(storageKeys.focus(
      ctx.chat.id,
      ctx.from.id,
      this.messageThreadId(ctx),
    ));
    if (focus?.type !== "focus") return false;

    return this.locks.run(focus.value.instanceId, async () => {
      const instance = await this.readInstance(focus.value.instanceId);
      if (instance === undefined || instance.status !== "active") return false;
      const selectedWindow = this.currentWindow(instance);
      if (!await this.canAccess(ctx, instance, selectedWindow)) return false;
      const matched = await this.matchInput(ctx, selectedWindow.input ?? []);
      if (matched === undefined) return false;

      if (matched.failure !== undefined) {
        const renderContext = await this.createRenderContext(instance, selectedWindow, ctx);
        await ctx.reply(await this.resolveText(matched.failure, renderContext));
        return true;
      }

      await this.executeIntent(ctx, instance, selectedWindow, matched.intent, undefined, matched.value);
      await this.finishUpdate(ctx.api, instance, ctx);
      return true;
    });
  }

  public async setLocale(api: Api, instanceId: string, locale: string, ctx?: C): Promise<void> {
    await this.locks.run(instanceId, async () => {
      const instance = await this.readInstance(instanceId);
      if (instance === undefined || instance.status !== "active") {
        throw new Error(`Active instance not found: ${instanceId}`);
      }
      instance.locale = locale;
      instance.revision += 1;
      await this.rerender(api, instance, ctx);
    });
  }

  private register(resources: ReadonlyArray<DialogResource<C>>): void {
    for (const resource of resources) {
      if (resource.kind === "window") {
        this.registerWindow(resource);
        continue;
      }

      if (this.dialogs.has(resource.id)) throw new Error(`Duplicate dialog id: ${resource.id}`);
      this.dialogs.set(resource.id, resource);
      for (const selectedWindow of Object.values(resource.windows)) this.registerWindow(selectedWindow);
      const initialId = this.resolveDialogWindow(resource, resource.initial);
      if (!this.windows.has(initialId)) {
        throw new Error(`Initial window '${resource.initial}' of dialog '${resource.id}' is not registered`);
      }
    }
  }

  private registerWindow(selectedWindow: AnyWindow<C>): void {
    const existing = this.windows.get(selectedWindow.id);
    if (existing !== undefined && existing !== selectedWindow) {
      throw new Error(`Duplicate window id: ${selectedWindow.id}`);
    }
    this.windows.set(selectedWindow.id, selectedWindow);
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

  private async mount(api: Api, instance: InstanceRecord, ctx?: C): Promise<void> {
    const rendered = await this.render(instance, ctx);
    try {
      const message = rendered.photo === undefined
        ? await api.sendMessage(instance.chatId, rendered.text || "\u2063", {
          reply_markup: rendered.replyMarkup,
          ...this.threadOptions(instance),
        })
        : await api.sendPhoto(instance.chatId, rendered.photo, {
          caption: rendered.text || undefined,
          reply_markup: rendered.replyMarkup,
          ...this.threadOptions(instance),
        });
      instance.surface = {
        chatId: instance.chatId,
        messageId: message.message_id,
        kind: rendered.photo === undefined ? "text" : "photo",
        hasKeyboard: rendered.replyMarkup !== undefined,
      };
      instance.callbackTokens = rendered.callbackTokens;
      await this.writeInstance(instance);
    } catch (error) {
      await this.deleteCallbacks(rendered.callbackTokens);
      throw error;
    }
  }

  private async processAction(ctx: C, token: string, callback: CallbackRecord): Promise<void> {
    const instance = await this.readInstance(callback.instanceId);
    if (instance === undefined || instance.status !== "active") return;
    if (callback.expiresAt !== undefined && callback.expiresAt < Date.now()) return;
    if (callback.revision !== instance.revision) return;
    if (callback.chatId !== ctx.chat?.id) return;
    if (callback.allowedUserId !== undefined && callback.allowedUserId !== ctx.from?.id) return;
    if (instance.surface?.messageId !== ctx.callbackQuery?.message?.message_id) return;

    const selectedWindow = this.currentWindow(instance);
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
    if (instance.status === "active" && ctx.from !== undefined) {
      await this.setFocus(instance, ctx.from.id);
    }
    await this.storage.delete(storageKeys.callback(token));
    await this.finishUpdate(ctx.api, instance, ctx);
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
        const resolved = this.resolveWindowForInstance(instance, windowId);
        this.requireWindow(resolved);
        instance.stack.push({ windowId: resolved, data });
      },
      replace: (windowId, data) => {
        const resolved = this.resolveWindowForInstance(instance, windowId);
        this.requireWindow(resolved);
        instance.stack[instance.stack.length - 1] = { windowId: resolved, data };
      },
      back: () => {
        if (instance.stack.length > 1) instance.stack.pop();
        else instance.status = "closed";
      },
      reset: (windowId, data) => {
        const resolved = this.resolveWindowForInstance(instance, windowId);
        this.requireWindow(resolved);
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
      if (instance.surface?.hasKeyboard === true) {
        await api.editMessageReplyMarkup(instance.surface.chatId, instance.surface.messageId, {
          reply_markup: { inline_keyboard: [] },
        });
      }
      const oldTokens = instance.callbackTokens;
      instance.callbackTokens = [];
      await this.deleteCallbacks(oldTokens);
      await this.clearFocus(instance);
      await this.writeInstance(instance);
      return;
    }
    await this.rerender(api, instance, ctx);
  }

  private async rerender(api: Api, instance: InstanceRecord, ctx?: C): Promise<void> {
    if (instance.surface === undefined) throw new Error(`Instance '${instance.id}' has no surface`);
    const oldTokens = instance.callbackTokens;
    const rendered = await this.render(instance, ctx);

    try {
      let messageId = instance.surface.messageId;
      if (instance.surface.kind === "text" && rendered.photo === undefined) {
        await api.editMessageText(instance.chatId, messageId, rendered.text || "\u2063", {
          reply_markup: rendered.replyMarkup,
        });
      } else if (instance.surface.kind === "photo" && rendered.photo !== undefined) {
        await api.editMessageMedia(instance.chatId, messageId, {
          type: "photo",
          media: rendered.photo,
          caption: rendered.text || undefined,
        }, { reply_markup: rendered.replyMarkup });
      } else {
        const message = rendered.photo === undefined
          ? await api.sendMessage(instance.chatId, rendered.text || "\u2063", {
            reply_markup: rendered.replyMarkup,
            ...this.threadOptions(instance),
          })
          : await api.sendPhoto(instance.chatId, rendered.photo, {
            caption: rendered.text || undefined,
            reply_markup: rendered.replyMarkup,
            ...this.threadOptions(instance),
          });
        await api.deleteMessage(instance.chatId, messageId);
        messageId = message.message_id;
      }

      instance.surface = {
        chatId: instance.chatId,
        messageId,
        kind: rendered.photo === undefined ? "text" : "photo",
        hasKeyboard: rendered.replyMarkup !== undefined,
      };
      instance.callbackTokens = rendered.callbackTokens;
      await this.writeInstance(instance);
      await this.deleteCallbacks(oldTokens);
    } catch (error) {
      await this.deleteCallbacks(rendered.callbackTokens);
      throw error;
    }
  }

  private async render(instance: InstanceRecord, ctx?: C): Promise<RenderedWindow> {
    const selectedWindow = this.currentWindow(instance);
    const renderContext = await this.createRenderContext(instance, selectedWindow, ctx);
    const text = selectedWindow.text === undefined
      ? ""
      : await this.resolveText(selectedWindow.text, renderContext);
    const media = selectedWindow.media === undefined
      ? undefined
      : typeof selectedWindow.media === "function"
        ? await selectedWindow.media(renderContext)
        : selectedWindow.media;
    const photo = media === undefined
      ? undefined
      : typeof media.source === "function"
        ? await media.source(renderContext)
        : media.source;
    const keyboard = selectedWindow.keyboard === undefined
      ? []
      : typeof selectedWindow.keyboard === "function"
        ? await selectedWindow.keyboard(renderContext)
        : selectedWindow.keyboard;
    const rows = await this.renderKeyboardNode(instance, keyboard, renderContext);
    const callbackTokens: string[] = [];
    const inlineKeyboard: InlineKeyboardMarkup["inline_keyboard"] = [];

    for (const [rowIndex, row] of rows.entries()) {
      const renderedRow: InlineKeyboardMarkup["inline_keyboard"][number] = [];
      for (const [columnIndex, definition] of row.entries()) {
        const label = await this.resolveText(definition.text, renderContext);
        if (definition.kind === "url") {
          const url = typeof definition.url === "function"
            ? await definition.url(renderContext)
            : definition.url;
          renderedRow.push({ text: label, url });
          continue;
        }

        const hint = `${selectedWindow.id}.${definition.id ?? `${rowIndex}.${columnIndex}`}`;
        const callbackData = this.codec.encode(hint);
        const token = this.codec.decode(callbackData)!;
        const record: CallbackRecord = {
          instanceId: instance.id,
          windowId: selectedWindow.id,
          revision: instance.revision,
          action: definition.action,
          chatId: instance.chatId,
          expiresAt: Date.now() + this.callbackTtlMs,
        };
        await this.storage.write(storageKeys.callback(token), {
          type: "callback",
          version: 1,
          value: record,
        });
        callbackTokens.push(token);
        renderedRow.push({ text: label, callback_data: callbackData });
      }
      if (renderedRow.length > 0) inlineKeyboard.push(renderedRow);
    }

    return {
      text,
      photo,
      replyMarkup: inlineKeyboard.length === 0 ? undefined : { inline_keyboard: inlineKeyboard },
      callbackTokens,
    };
  }

  private async createRenderContext(
    instance: InstanceRecord,
    selectedWindow: AnyWindow<C>,
    ctx?: C,
  ): Promise<RenderContext<C, unknown, Services>> {
    const state = this.stateHandle(instance);
    const vm = await selectedWindow.viewModel.load({
      ctx,
      state: state.value,
      services: this.services,
      actor: { id: ctx?.from?.id ?? instance.ownerId, chatId: instance.chatId },
    });
    return {
      ctx,
      vm,
      services: this.services,
      locale: instance.locale,
      t: (key, params) => this.translate(instance.locale, key, params),
    };
  }

  private async renderKeyboardNode(
    instance: InstanceRecord,
    node: KeyboardNode<C, any, Services>,
    context: RenderContext<C, any, Services>,
  ) {
    if (Array.isArray(node)) return node;
    const widget = node as KeyboardWidgetInstance<C, any, Services, any, any>;
    const state = this.widgetStateHandle(instance, widget);
    const actions = Object.fromEntries(
      Object.keys(widget.definition.actions).map(action => [
        action,
        (payload?: unknown) => ({
          kind: "widget" as const,
          widgetId: widget.id,
          action,
          payload,
        }),
      ]),
    );
    return widget.definition.render({
      ...context,
      props: widget.props,
      state,
      actions,
    });
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
    const renderContext = await this.createRenderContext(instance, selectedWindow, ctx);
    const node = typeof selectedWindow.keyboard === "function"
      ? await selectedWindow.keyboard(renderContext)
      : selectedWindow.keyboard;
    if (!this.isKeyboardWidget(node) || node.id !== action.widgetId) {
      throw new Error(`Widget '${action.widgetId}' is not present in window '${selectedWindow.id}'`);
    }
    const handler = node.definition.actions[action.action];
    if (handler === undefined) {
      throw new Error(`Unknown action '${action.action}' in widget '${action.widgetId}'`);
    }
    await handler({
      ctx,
      props: node.props,
      state: this.widgetStateHandle(instance, node),
      services: this.services,
      navigation: this.navigation(instance),
      payload: action.payload,
    });
  }

  private widgetStateHandle(
    instance: InstanceRecord,
    widget: KeyboardWidgetInstance<C, any, Services, any, any>,
  ): StateHandle<any> {
    let record = instance.widgetStates[widget.id];
    if (record === undefined || record.version !== widget.definition.state.version) {
      record = {
        version: widget.definition.state.version,
        value: widget.definition.state.initial(widget.props),
      };
      instance.widgetStates[widget.id] = record;
    }
    return new StateHandle(record.value, value => {
      instance.widgetStates[widget.id] = {
        version: widget.definition.state.version,
        value,
      };
    });
  }

  private isKeyboardWidget(
    node: KeyboardNode<C, any, Services>,
  ): node is KeyboardWidgetInstance<C, any, Services, any, any> {
    return !Array.isArray(node) && (node as { kind?: string }).kind === "keyboard-widget";
  }

  private async resolveText(
    source: TextSource<C, any, Services>,
    context: RenderContext<C, any, Services>,
  ): Promise<string> {
    const value = typeof source === "function" ? await source(context) : source;
    return this.isTranslation(value)
      ? this.translate(context.locale, value.key, value.params)
      : value;
  }

  private isTranslation(value: string | Translation): value is Translation {
    return typeof value === "object" && value.kind === "translation";
  }

  private async translate(
    locale: string,
    key: string,
    params?: Record<string, unknown>,
  ): Promise<string> {
    if (this.translator === undefined) {
      throw new Error(`Translation '${key}' was requested, but no i18n adapter is configured`);
    }
    return this.translator.translate(locale, key, params);
  }

  private async resolveLocale(ctx: C): Promise<string> {
    return this.localeResolver?.resolve(ctx) ?? this.defaultLocale;
  }

  private stateHandle(instance: InstanceRecord): StateHandle<any> {
    return new StateHandle(instance.state, state => {
      instance.state = state;
    });
  }

  private currentWindow(instance: InstanceRecord): AnyWindow<C> {
    const frame = instance.stack[instance.stack.length - 1];
    if (frame === undefined) throw new Error(`Instance '${instance.id}' has an empty stack`);
    return this.requireWindow(frame.windowId);
  }

  private requireWindow(id: string): AnyWindow<C> {
    const selectedWindow = this.windows.get(id);
    if (selectedWindow === undefined) throw new Error(`Unknown window: ${id}`);
    return selectedWindow;
  }

  private resolveWindowForInstance(instance: InstanceRecord, reference: string): string {
    if (instance.kind !== "dialog") return reference;
    const dialog = this.dialogs.get(instance.definitionId);
    return dialog === undefined ? reference : this.resolveDialogWindow(dialog, reference);
  }

  private resolveDialogWindow(dialog: DialogDefinition<C>, reference: string): string {
    return dialog.windows[reference]?.id ?? reference;
  }

  private async matchInput(
    ctx: C,
    inputs: ReadonlyArray<InputDefinition<C>>,
  ): Promise<{ intent: string; value?: unknown; failure?: TextSource } | undefined> {
    for (const input of inputs) {
      if (input.kind === "text" && ctx.message?.text !== undefined) {
        const value = input.trim ? ctx.message.text.trim() : ctx.message.text;
        const validation = await input.validate?.(value) ?? { ok: true as const, value };
        if (!validation.ok) return { intent: input.onReceive, failure: validation.message ?? "Invalid value" };
        return { intent: input.onReceive, value: validation.value };
      }

      if (input.kind === "photo" && ctx.message?.photo !== undefined) {
        const selected = ctx.message.photo[ctx.message.photo.length - 1];
        if (selected === undefined) continue;
        return {
          intent: input.onReceive,
          value: {
            fileId: selected.file_id,
            fileUniqueId: selected.file_unique_id,
            width: selected.width,
            height: selected.height,
            fileSize: selected.file_size,
            caption: ctx.message.caption,
            messageId: ctx.message.message_id,
          },
        };
      }

      if (input.kind === "custom" && await input.match(ctx)) {
        const value = await input.parse(ctx);
        const validation = await input.validate?.(value) ?? { ok: true as const, value };
        if (!validation.ok) {
          return { intent: input.onReceive, failure: validation.message ?? "Invalid value" };
        }
        return { intent: input.onReceive, value: validation.value };
      }
    }
    return undefined;
  }

  private async setFocus(instance: InstanceRecord, userId = instance.ownerId): Promise<void> {
    if (userId === undefined) return;
    if (!instance.focusedUserIds.includes(userId)) instance.focusedUserIds.push(userId);
    await this.storage.write(storageKeys.focus(instance.chatId, userId, instance.threadId), {
      type: "focus",
      version: 1,
      value: { instanceId: instance.id },
    });
    await this.writeInstance(instance);
  }

  private async clearFocus(instance: InstanceRecord): Promise<void> {
    await Promise.all(instance.focusedUserIds.map(async userId => {
      const key = storageKeys.focus(instance.chatId, userId, instance.threadId);
      const focus = await this.storage.read(key);
      if (focus?.type === "focus" && focus.value.instanceId === instance.id) {
        await this.storage.delete(key);
      }
    }));
    instance.focusedUserIds = [];
  }

  private messageThreadId(ctx: C): number | undefined {
    return (ctx.msg as { message_thread_id?: number } | undefined)?.message_thread_id;
  }

  private threadOptions(instance: InstanceRecord): { message_thread_id?: number } {
    return instance.threadId === undefined ? {} : { message_thread_id: instance.threadId };
  }

  private async canAccess(
    ctx: C,
    instance: InstanceRecord,
    selectedWindow: AnyWindow<C>,
  ): Promise<boolean> {
    const dialog = instance.kind === "dialog" ? this.dialogs.get(instance.definitionId) : undefined;
    const strategy = selectedWindow.access ?? dialog?.access ?? this.defaultAccess;
    return strategy.allows(ctx, instance);
  }

  private async readInstance(id: string): Promise<InstanceRecord | undefined> {
    const record = await this.storage.read(storageKeys.instance(id));
    return record?.type === "instance" ? record.value : undefined;
  }

  private async writeInstance(instance: InstanceRecord): Promise<void> {
    await this.storage.write(storageKeys.instance(instance.id), {
      type: "instance",
      version: 1,
      value: instance,
    });
  }

  private async deleteCallbacks(tokens: ReadonlyArray<string>): Promise<void> {
    await Promise.all(tokens.map(token => this.storage.delete(storageKeys.callback(token))));
  }
}
