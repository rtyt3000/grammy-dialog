import type { Context } from "grammy";
import type {
  DialogDefinition,
  DialogResource,
  ViewModelDefinition,
  WindowDefinition,
} from "../core.js";
import type { InstanceRecord } from "../persistence/storage.js";

/** Window definition with erased state, view, and service parameters. */
export type AnyWindow<C extends Context> = WindowDefinition<C, any, any, any>;

/** Resolves registered dialogs, standalone windows, and dialog-local aliases. */
export class DefinitionRegistry<C extends Context = Context> {
  private readonly dialogs = new Map<
    string,
    DialogDefinition<C, any, any, any>
  >();
  private readonly windows = new Map<string, AnyWindow<C>>();

  public constructor(resources: ReadonlyArray<DialogResource<C>>) {
    this.register(resources);
  }

  /** Resolves a dialog id or returns the supplied definition. */
  public dialog(
    reference: string | DialogDefinition<any, any, any, any>,
  ): DialogDefinition<C, any, any, any> {
    const id = typeof reference === "string" ? reference : reference.id;
    const dialog = this.dialogs.get(id);
    if (dialog === undefined) throw new Error(`Unknown dialog: ${id}`);
    return dialog;
  }

  /** Finds a dialog without throwing when it is not registered. */
  public findDialog(
    id: string,
  ): DialogDefinition<C, any, any, any> | undefined {
    return this.dialogs.get(id);
  }

  /** Resolves a window id or returns the supplied definition. */
  public window(
    reference: string | WindowDefinition<any, any, any, any>,
  ): AnyWindow<C> {
    const id = typeof reference === "string" ? reference : reference.id;
    const selectedWindow = this.windows.get(id);
    if (selectedWindow === undefined) throw new Error(`Unknown window: ${id}`);
    return selectedWindow;
  }

  /** Resolves the window at the top of an instance navigation stack. */
  public currentWindow(instance: InstanceRecord): AnyWindow<C> {
    const frame = instance.stack[instance.stack.length - 1];
    if (frame === undefined)
      throw new Error(`Instance '${instance.id}' has an empty stack`);
    return this.window(frame.windowId);
  }

  /** Resolves the state owner for a dialog or standalone window instance. */
  public viewModel(
    instance: InstanceRecord,
    selectedWindow = this.currentWindow(instance),
  ): ViewModelDefinition<any, any, C, any> {
    if (instance.kind === "dialog") {
      const dialog = this.dialogs.get(instance.definitionId);
      if (dialog === undefined)
        throw new Error(`Unknown dialog: ${instance.definitionId}`);
      return dialog.viewModel;
    }
    if (selectedWindow.viewModel === undefined) {
      throw new Error(
        `Standalone window '${selectedWindow.id}' has no ViewModel`,
      );
    }
    return selectedWindow.viewModel;
  }

  /** Resolves a window reference relative to an instance's dialog definition. */
  public resolveForInstance(
    instance: InstanceRecord,
    reference: string,
  ): string {
    if (instance.kind !== "dialog") return reference;
    const dialog = this.dialogs.get(instance.definitionId);
    return dialog === undefined
      ? reference
      : this.resolveDialogWindow(dialog, reference);
  }

  /** Resolves either a dialog-local key or a globally registered window id. */
  public resolveDialogWindow(
    dialog: DialogDefinition<C, any, any, any>,
    reference: string,
  ): string {
    return dialog.windows[reference]?.id ?? reference;
  }

  private register(resources: ReadonlyArray<DialogResource<C>>): void {
    for (const resource of resources) {
      if (resource.kind === "window") {
        this.registerWindow(resource);
        continue;
      }

      if (this.dialogs.has(resource.id))
        throw new Error(`Duplicate dialog id: ${resource.id}`);
      this.dialogs.set(resource.id, resource);
      for (const selectedWindow of Object.values(resource.windows)) {
        this.registerWindow(selectedWindow);
      }
      const initialId = this.resolveDialogWindow(resource, resource.initial);
      if (!this.windows.has(initialId)) {
        throw new Error(
          `Initial window '${resource.initial}' of dialog '${resource.id}' is not registered`,
        );
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
}
