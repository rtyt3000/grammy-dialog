import type { RenderedWindow } from "../runtime/window-renderer.js";
import type { SurfaceReference } from "../persistence/storage.js";
import type {
  PresentationOperation,
  PresentationStrategy,
} from "./contracts.js";

/** Normalizes presentation strategy decisions and edit-error recovery. */
export class PresentationPlanner {
  public constructor(private readonly strategy: PresentationStrategy) {}

  /** Selects the presentation operation for the current and next surface kinds. */
  public plan(
    current: SurfaceReference,
    rendered: RenderedWindow,
  ): Promise<PresentationOperation> | PresentationOperation {
    return this.strategy.plan({
      current,
      nextKind: rendered.media?.kind ?? "text",
    });
  }

  /** Chooses whether to replace a surface after its Telegram edit failed. */
  public async fallbackAfterEditError(error: unknown): Promise<"replace" | "throw"> {
    return await this.strategy.fallbackAfterEditError?.(error) ?? "throw";
  }
}
