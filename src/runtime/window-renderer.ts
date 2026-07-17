import type { Context, InputFile } from "grammy";
import type { InlineKeyboardMarkup, ParseMode } from "grammy/types";
import type { CallbackCodec } from "../callbacks/codec.js";
import {
  type KeyboardNode,
  type KeyboardWidgetInstance,
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

export interface RenderedMedia {
  kind: MediaKind;
  source: string | InputFile;
}

export interface RenderedWindow {
  text: string;
  parseMode?: ParseMode;
  media?: RenderedMedia;
  replyMarkup?: InlineKeyboardMarkup;
  callbackTokens: string[];
}

export interface WindowRendererOptions<
  C extends Context,
  Services,
> {
  registry: DefinitionRegistry<C>;
  repository: DialogRepository;
  services: Services;
  codec: CallbackCodec;
  translator?: TranslationAdapter;
  callbackTtlMs: number;
}

export class WindowRenderer<
  C extends Context = Context,
  Services = unknown,
> {
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

  public async render(instance: InstanceRecord, ctx?: C): Promise<RenderedWindow> {
    const selectedWindow = this.registry.currentWindow(instance);
    const renderContext = await this.createContext(instance, selectedWindow, ctx);
    const text = selectedWindow.text === undefined
      ? ""
      : await this.resolveText(selectedWindow.text, renderContext);
    const media = selectedWindow.media === undefined
      ? undefined
      : typeof selectedWindow.media === "function"
        ? await selectedWindow.media(renderContext)
        : selectedWindow.media;
    const mediaSource = media === undefined
      ? undefined
      : typeof media.source === "function"
        ? await media.source(renderContext)
        : media.source;
    const renderedMedia = media === undefined || mediaSource === undefined
      ? undefined
      : { kind: media.kind, source: mediaSource };
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
        await this.repository.writeCallback(token, record);
        callbackTokens.push(token);
        renderedRow.push({ text: label, callback_data: callbackData });
      }
      if (renderedRow.length > 0) inlineKeyboard.push(renderedRow);
    }

    return {
      text,
      parseMode: selectedWindow.parseMode,
      media: renderedMedia,
      replyMarkup: inlineKeyboard.length === 0 ? undefined : { inline_keyboard: inlineKeyboard },
      callbackTokens,
    };
  }

  public async createContext(
    instance: InstanceRecord,
    selectedWindow: AnyWindow<C>,
    ctx?: C,
  ): Promise<RenderContext<C, unknown, Services>> {
    const state = this.instanceState(instance);
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

  public async resolveText(
    source: TextSource<C, any, Services>,
    context: RenderContext<C, any, Services>,
  ): Promise<string> {
    const value = typeof source === "function" ? await source(context) : source;
    return this.isTranslation(value)
      ? this.translate(context.locale, value.key, value.params)
      : value;
  }

  public widgetState(
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

  public isKeyboardWidget(
    node: KeyboardNode<C, any, Services>,
  ): node is KeyboardWidgetInstance<C, any, Services, any, any> {
    return !Array.isArray(node) && (node as { kind?: string }).kind === "keyboard-widget";
  }

  private async renderKeyboardNode(
    instance: InstanceRecord,
    node: KeyboardNode<C, any, Services>,
    context: RenderContext<C, any, Services>,
  ) {
    if (Array.isArray(node)) return node;
    const widget = node as KeyboardWidgetInstance<C, any, Services, any, any>;
    const state = this.widgetState(instance, widget);
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

  private instanceState(instance: InstanceRecord): StateHandle<any> {
    return new StateHandle(instance.state, state => {
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
      throw new Error(`Translation '${key}' was requested, but no i18n adapter is configured`);
    }
    return this.translator.translate(locale, key, params);
  }
}
