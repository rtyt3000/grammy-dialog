import type { Awaitable } from "../core.js";
import type { InstanceRecord, SurfaceReference } from "../persistence/storage.js";

/** Telegram surface kind currently mounted by an instance. */
export type SurfaceKind = SurfaceReference["kind"];
/** Mutation used to display the next render. */
export type PresentationOperation = "edit" | "replace" | "send";
/** Mutation applied to a surface when its instance closes. */
export type CloseOperation = "keep" | "detach" | "delete";

/** Values passed to a presentation strategy. */
export interface PresentationPlanContext {
  readonly current: SurfaceReference;
  readonly nextKind: SurfaceKind;
}

/** Chooses how a new render replaces or accompanies the current surface. */
export interface PresentationStrategy {
  readonly id: string;
  plan(context: PresentationPlanContext): Awaitable<PresentationOperation>;
  fallbackAfterEditError?(error: unknown): Awaitable<"replace" | "throw">;
}

/** Values passed to a close strategy. */
export interface ClosePlanContext {
  readonly instance: Readonly<InstanceRecord>;
  readonly surface: SurfaceReference;
}

/** Chooses what happens to the Telegram surface after instance closure. */
export interface CloseStrategy {
  readonly id: string;
  plan(context: ClosePlanContext): Awaitable<CloseOperation>;
}
