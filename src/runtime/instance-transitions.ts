import type { NavigationController } from "../core.js";
import type { InstanceRecord } from "../persistence/storage.js";
import type { DefinitionRegistry } from "./definition-registry.js";

/** Applies pure navigation transitions while preserving instance invariants. */
export class InstanceTransitions {
  public constructor(
    private readonly registry: DefinitionRegistry<any>,
    private readonly maxStackDepth: number,
  ) {
    if (!Number.isSafeInteger(maxStackDepth) || maxStackDepth < 1) {
      throw new RangeError("maxStackDepth must be a positive safe integer");
    }
  }

  /** Creates the imperative navigation facade exposed to event handlers. */
  public controller(instance: InstanceRecord): NavigationController {
    return {
      go: (windowId, data) => this.go(instance, windowId, data),
      replace: (windowId, data) => this.replace(instance, windowId, data),
      back: () => this.back(instance),
      reset: (windowId, data) => this.reset(instance, windowId, data),
      close: result => this.close(instance, result),
    };
  }

  private go(instance: InstanceRecord, windowId: string, data?: unknown): void {
    if (instance.stack.length >= this.maxStackDepth) {
      throw new Error(
        `Dialog instance '${instance.id}' exceeded the stack depth limit of ${this.maxStackDepth}`,
      );
    }
    instance.stack.push({ windowId: this.resolve(instance, windowId), data });
  }

  private replace(instance: InstanceRecord, windowId: string, data?: unknown): void {
    instance.stack[instance.stack.length - 1] = {
      windowId: this.resolve(instance, windowId),
      data,
    };
  }

  private back(instance: InstanceRecord): void {
    if (instance.stack.length > 1) instance.stack.pop();
    else this.close(instance);
  }

  private reset(instance: InstanceRecord, windowId: string, data?: unknown): void {
    instance.stack = [{ windowId: this.resolve(instance, windowId), data }];
  }

  private close(instance: InstanceRecord, result?: unknown): void {
    instance.status = "closed";
    instance.result = result;
  }

  private resolve(instance: InstanceRecord, windowId: string): string {
    const resolved = this.registry.resolveForInstance(instance, windowId);
    this.registry.window(resolved);
    return resolved;
  }
}
