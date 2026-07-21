import type { Context } from "grammy";
import { type ButtonAction, StateHandle } from "../core.js";
import type { InstanceRecord } from "../persistence/storage.js";
import type { AnyWindow, DefinitionRegistry } from "./definition-registry.js";
import type { InstanceTransitions } from "./instance-transitions.js";
import type { WindowRenderer } from "./window-renderer.js";

/** Executes definition-bound intents and widget actions without performing I/O commits. */
export class ActionExecutor<C extends Context, Services> {
  public constructor(
    private readonly registry: DefinitionRegistry<C>,
    private readonly renderer: WindowRenderer<C, Services>,
    private readonly services: Services,
    private readonly transitions: InstanceTransitions,
  ) {}

  /** Executes any callback action against an in-memory instance snapshot. */
  public async execute(
    ctx: C,
    instance: InstanceRecord,
    selectedWindow: AnyWindow<C>,
    action: ButtonAction,
  ): Promise<void> {
    if (action.kind === "intent") {
      await this.intent(
        ctx,
        instance,
        selectedWindow,
        action.name,
        action.payload,
        undefined,
      );
      return;
    }
    if (action.kind === "widget") {
      await this.widget(ctx, instance, selectedWindow, action);
      return;
    }
    const navigation = this.transitions.controller(instance);
    switch (action.kind) {
      case "go":
        navigation.go(action.windowId, action.data);
        break;
      case "replace":
        navigation.replace(action.windowId, action.data);
        break;
      case "back":
        navigation.back();
        break;
      case "reset":
        navigation.reset(action.windowId, action.data);
        break;
      case "close":
        navigation.close(action.result);
        break;
    }
  }

  /** Executes one ViewModel intent from a callback or matched input. */
  public async intent(
    ctx: C,
    instance: InstanceRecord,
    selectedWindow: AnyWindow<C>,
    name: string,
    payload: unknown,
    value: unknown,
  ): Promise<void> {
    const viewModel = this.registry.viewModel(instance, selectedWindow);
    const handler = viewModel.intents[name];
    if (handler === undefined) {
      throw new Error(
        `Unknown intent '${name}' in window '${selectedWindow.id}'`,
      );
    }
    const state = new StateHandle(instance.state, (next) => {
      instance.state = next;
    });
    const vm = await viewModel.load({
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
      navigation: this.transitions.controller(instance),
      payload,
      value,
    });
  }

  private async widget(
    ctx: C,
    instance: InstanceRecord,
    selectedWindow: AnyWindow<C>,
    action: Extract<ButtonAction, { kind: "widget" }>,
  ): Promise<void> {
    const renderContext = await this.renderer.createContext(
      instance,
      selectedWindow,
      ctx,
    );
    const node = await this.renderer.resolveKeyboard(
      selectedWindow,
      renderContext,
    );
    const widget = await this.renderer.findKeyboardWidget(
      instance,
      node,
      renderContext,
      action.widgetId,
    );
    if (widget === undefined) {
      throw new Error(
        `Widget '${action.widgetId}' is not present in window '${selectedWindow.id}'`,
      );
    }
    const handler = widget.definition.actions[action.action];
    if (handler === undefined) {
      throw new Error(
        `Unknown action '${action.action}' in widget '${action.widgetId}'`,
      );
    }
    await handler({
      ctx,
      props: widget.props,
      state: this.renderer.widgetState(instance, widget),
      services: this.services,
      navigation: this.transitions.controller(instance),
      payload: action.payload,
    });
  }
}
