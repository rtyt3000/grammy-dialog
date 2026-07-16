import type { Context } from "grammy";
import type {
  DialogDefinition,
  DialogResource,
  WindowDefinition,
} from "./core.js";
import type { InstanceRecord } from "./storage.js";

export type AnyWindow<C extends Context> = WindowDefinition<C, any, any, any>;

export class DefinitionRegistry<C extends Context = Context> {
  private readonly dialogs = new Map<string, DialogDefinition<C>>();
  private readonly windows = new Map<string, AnyWindow<C>>();

  public constructor(resources: ReadonlyArray<DialogResource<C>>) {
    this.register(resources);
  }

  public dialog(reference: string | DialogDefinition): DialogDefinition<C> {
    const id = typeof reference === "string" ? reference : reference.id;
    const dialog = this.dialogs.get(id);
    if (dialog === undefined) throw new Error(`Unknown dialog: ${id}`);
    return dialog;
  }

  public findDialog(id: string): DialogDefinition<C> | undefined {
    return this.dialogs.get(id);
  }

  public window(reference: string | WindowDefinition): AnyWindow<C> {
    const id = typeof reference === "string" ? reference : reference.id;
    const selectedWindow = this.windows.get(id);
    if (selectedWindow === undefined) throw new Error(`Unknown window: ${id}`);
    return selectedWindow;
  }

  public currentWindow(instance: InstanceRecord): AnyWindow<C> {
    const frame = instance.stack[instance.stack.length - 1];
    if (frame === undefined) throw new Error(`Instance '${instance.id}' has an empty stack`);
    return this.window(frame.windowId);
  }

  public resolveForInstance(instance: InstanceRecord, reference: string): string {
    if (instance.kind !== "dialog") return reference;
    const dialog = this.dialogs.get(instance.definitionId);
    return dialog === undefined ? reference : this.resolveDialogWindow(dialog, reference);
  }

  public resolveDialogWindow(dialog: DialogDefinition<C>, reference: string): string {
    return dialog.windows[reference]?.id ?? reference;
  }

  private register(resources: ReadonlyArray<DialogResource<C>>): void {
    for (const resource of resources) {
      if (resource.kind === "window") {
        this.registerWindow(resource);
        continue;
      }

      if (this.dialogs.has(resource.id)) throw new Error(`Duplicate dialog id: ${resource.id}`);
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
