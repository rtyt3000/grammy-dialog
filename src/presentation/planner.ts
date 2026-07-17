import type { RenderedWindow } from "../runtime/window-renderer.js";
import type { SurfaceReference } from "../persistence/storage.js";
import type {
  PresentationOperation,
  PresentationStrategy,
} from "./contracts.js";

export class PresentationPlanner {
  public constructor(private readonly strategy: PresentationStrategy) {}

  public plan(
    current: SurfaceReference,
    rendered: RenderedWindow,
  ): Promise<PresentationOperation> | PresentationOperation {
    return this.strategy.plan({
      current,
      nextKind: rendered.media?.kind ?? "text",
    });
  }

  public async fallbackAfterEditError(error: unknown): Promise<"replace" | "throw"> {
    return await this.strategy.fallbackAfterEditError?.(error) ?? "throw";
  }
}
