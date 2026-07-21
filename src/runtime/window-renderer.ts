import type { Context, InputFile } from "grammy";
import type { InlineKeyboardMarkup, ParseMode } from "grammy/types";
import type { CallbackCodec } from "../callbacks/codec.js";
import {
  type KeyboardDefinition,
  type KeyboardNode,
  type KeyboardWidgetInstance,
  type InputDefinition,
  type RenderContext,
  StateHandle,
  type TextSource,
  type Translation,
  type TranslationAdapter,
} from "../core.js";
import type { AnyWindow, DefinitionRegistry } from "./definition-registry.js";
import type { DialogRepository } from "../persistence/dialog-repository.js";
import type { CallbackRecord, InstanceRecord } from "../persistence/storage.js";
import type { MediaKind } from "../core.js";
import { renderJsxKeyboard, renderJsxView } from "../jsx/render.js";

/** Resolved media ready to pass to the Telegram Bot API. */
export interface RenderedMedia {
  kind: MediaKind;
  source: string | InputFile;
}

/** Complete render result consumed by the surface manager. */
export interface RenderedWindow {
  text: string;
  parseMode?: ParseMode;
  media?: RenderedMedia;
  replyMarkup?: InlineKeyboardMarkup;
  callbackTokens: string[];
}

/** Dependencies required to render windows and register their callbacks. */
export interface WindowRendererOptions<C extends Context, Services> {
  registry: DefinitionRegistry<C>;
  repository: DialogRepository;
  services: Services;
  codec: CallbackCodec;
  translator?: TranslationAdapter;
  callbackTtlMs: number;
}

/** Resolves ViewModels, translations, media, keyboards, and widget state. */
export class WindowRenderer<C extends Context = Context, Services = unknown> {
  private readonly registry: DefinitionRegistry<C>;
  private readonly repository: DialogRepository;
  private readonly services: Services;
  private readonly codec: CallbackCodec;
  private readonly translator?: TranslationAdapter;
  private readonly callbackTtlMs: number;

  public constructor(options: WindowRendererOptions<C, Services>) {
    this.registry = options.registry;
    this.repository = options.repository;
    this.services = options.services;
    this.codec = options.codec;
    this.translator = options.translator;
    this.callbackTtlMs = options.callbackTtlMs;
  }

  /** Renders the current stack window and persists generated callback bindings. */
  public async render(
    instance: InstanceRecord,
    ctx?: C,
  ): Promise<RenderedWindow> {
    const selectedWindow = this.registry.currentWindow(instance);
    const renderContext = await this.createContext(
      instance,
      selectedWindow,
      ctx,
    );
    const jsxView = await renderJsxView(
      selectedWindow.view === undefined
        ? null
        : typeof selectedWindow.view === "function"
          ? await selectedWindow.view(renderContext)
          : selectedWindow.view,
    );
    const text = jsxView.text;
    const media = jsxView.media;
    const mediaSource =
      media === undefined
        ? undefined
        : typeof media.source === "function"
          ? await media.source(renderContext)
          : media.source;
    const renderedMedia =
      media === undefined || mediaSource === undefined
        ? undefined
        : { kind: media.kind, source: mediaSource };
    const keyboard = jsxView.keyboard;
    const rows = await this.renderKeyboardNode(
      instance,
      keyboard,
      renderContext,
      new Map(),
    );
    const callbackTokens: string[] = [];
    const inlineKeyboard: InlineKeyboardMarkup["inline_keyboard"] = [];

    for (const [rowIndex, row] of rows.entries()) {
      const renderedRow: InlineKeyboardMarkup["inline_keyboard"][number] = [];
      for (const [columnIndex, definition] of row.entries()) {
        const label = await this.resolveText(definition.text, renderContext);
        if (definition.kind === "url") {
          const url =
            typeof definition.url === "function"
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
          revision: instance.revision,
          action: definition.action,
          chatId: instance.chatId,
          expiresAt: Date.now() + this.callbackTtlMs,
        };
        await this.repository.writeCallback(token, record);
        callbackTokens.push(token);
        renderedRow.push({ text: label, callback_data: callbackData });
      }
      if (renderedRow.length > 0) inlineKeyboard.push(renderedRow);
    }

    return {
      text,
      parseMode: "HTML",
      media: renderedMedia,
      replyMarkup:
        inlineKeyboard.length === 0
          ? undefined
          : { inline_keyboard: inlineKeyboard },
      callbackTokens,
    };
  }

  /** Resolves the keyboard tree used by callback action execution. */
  public async resolveKeyboard(
    selectedWindow: AnyWindow<C>,
    context: RenderContext<C, any, Services>,
  ): Promise<KeyboardNode<C, any, Services>> {
    const node =
      selectedWindow.view === undefined
        ? null
        : typeof selectedWindow.view === "function"
          ? await selectedWindow.view(context)
          : selectedWindow.view;
    return (await renderJsxView(node)).keyboard as KeyboardNode<
      C,
      any,
      Services
    >;
  }

  /** Resolves input bindings declared statically and inside the JSX view. */
  public async resolveInputs(
    instance: InstanceRecord,
    selectedWindow: AnyWindow<C>,
    ctx?: C,
  ): Promise<ReadonlyArray<InputDefinition<C>>> {
    const context = await this.createContext(instance, selectedWindow, ctx);
    const node =
      selectedWindow.view === undefined
        ? null
        : typeof selectedWindow.view === "function"
          ? await selectedWindow.view(context)
          : selectedWindow.view;
    return [
      ...(selectedWindow.input ?? []),
      ...((await renderJsxView(node)).inputs as ReadonlyArray<
        InputDefinition<C>
      >),
    ];
  }

  /** Loads a ViewModel and constructs its render context. */
  public async createContext(
    instance: InstanceRecord,
    selectedWindow: AnyWindow<C>,
    ctx?: C,
  ): Promise<RenderContext<C, unknown, Services>> {
    const state = this.instanceState(instance);
    const viewModel = this.registry.viewModel(instance, selectedWindow);
    const vm = await viewModel.load({
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

  /** Resolves static, functional, or translated text. */
  public async resolveText(
    source: TextSource<C, any, Services>,
    context: RenderContext<C, any, Services>,
  ): Promise<string> {
    const value = typeof source === "function" ? await source(context) : source;
    return this.isTranslation(value)
      ? this.translate(context.locale, value.key, value.params)
      : value;
  }

  /** Returns a mutable handle and initializes or resets versioned widget state. */
  public widgetState(
    instance: InstanceRecord,
    widget: KeyboardWidgetInstance<C, any, Services, any, any>,
  ): StateHandle<any> {
    let record = instance.widgetStates[widget.id];
    if (
      record === undefined ||
      record.version !== widget.definition.state.version
    ) {
      record = {
        version: widget.definition.state.version,
        value:
          record === undefined || widget.definition.state.migrate === undefined
            ? widget.definition.state.initial(widget.props)
            : widget.definition.state.migrate(
                record.value,
                record.version,
                widget.props,
              ),
      };
      instance.widgetStates[widget.id] = record;
    }
    return new StateHandle(record.value, (value) => {
      instance.widgetStates[widget.id] = {
        version: widget.definition.state.version,
        value,
      };
    });
  }

  /** Narrows a keyboard node to a mounted stateful widget. */
  public isKeyboardWidget(
    node: KeyboardNode<C, any, Services>,
  ): node is KeyboardWidgetInstance<C, any, Services, any, any> {
    return (
      !Array.isArray(node) &&
      (node as { kind?: string }).kind === "keyboard-widget"
    );
  }

  /** Narrows a keyboard node to a composition group. */
  public isKeyboardGroup(
    node: KeyboardNode<C, any, Services>,
  ): node is Extract<
    KeyboardNode<C, any, Services>,
    { kind: "keyboard-group" }
  > {
    return (
      !Array.isArray(node) &&
      (node as { kind?: string }).kind === "keyboard-group"
    );
  }

  private async renderKeyboardNode(
    instance: InstanceRecord,
    node: KeyboardNode<C, any, Services>,
    context: RenderContext<C, any, Services>,
    widgets: Map<string, KeyboardWidgetInstance<C, any, Services, any, any>>,
  ): Promise<KeyboardDefinition<C, any, Services>> {
    if (Array.isArray(node)) return node;
    if (this.isKeyboardGroup(node)) {
      const rows: KeyboardDefinition<C, any, Services>[] = await Promise.all(
        node.children.map((child) =>
          this.renderKeyboardNode(instance, child, context, widgets),
        ),
      );
      return rows.flat();
    }
    const widget = node as KeyboardWidgetInstance<C, any, Services, any, any>;
    if (widgets.has(widget.id)) {
      throw new Error(`Duplicate keyboard widget id: ${widget.id}`);
    }
    widgets.set(widget.id, widget);
    const state = this.widgetState(instance, widget);
    const actions = Object.fromEntries(
      Object.keys(widget.definition.actions).map((action) => [
        action,
        (payload?: unknown) => ({
          kind: "widget" as const,
          widgetId: widget.id,
          action,
          payload,
        }),
      ]),
    );
    const rendered = await widget.definition.render({
      ...context,
      props: widget.props,
      state,
      actions,
    });
    return this.renderKeyboardNode(
      instance,
      (await renderJsxKeyboard(rendered)) as KeyboardNode<C, any, Services>,
      context,
      widgets,
    );
  }

  /** Expands the rendered widget tree and finds one uniquely mounted widget. */
  public async findKeyboardWidget(
    instance: InstanceRecord,
    node: KeyboardNode<C, any, Services>,
    context: RenderContext<C, any, Services>,
    id: string,
  ): Promise<KeyboardWidgetInstance<C, any, Services, any, any> | undefined> {
    const widgets = new Map<
      string,
      KeyboardWidgetInstance<C, any, Services, any, any>
    >();
    await this.renderKeyboardNode(instance, node, context, widgets);
    return widgets.get(id);
  }

  private instanceState(instance: InstanceRecord): StateHandle<any> {
    return new StateHandle(instance.state, (state) => {
      instance.state = state;
    });
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
      throw new Error(
        `Translation '${key}' was requested, but no i18n adapter is configured`,
      );
    }
    return this.translator.translate(locale, key, params);
  }
}
