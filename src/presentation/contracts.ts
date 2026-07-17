import type { Awaitable } from "../core.js";
import type { InstanceRecord, SurfaceReference } from "../persistence/storage.js";

export type SurfaceKind = SurfaceReference["kind"];
export type PresentationOperation = "edit" | "replace" | "send";
export type CloseOperation = "keep" | "detach" | "delete";

export interface PresentationPlanContext {
  readonly current: SurfaceReference;
  readonly nextKind: SurfaceKind;
}

export interface PresentationStrategy {
  readonly id: string;
  plan(context: PresentationPlanContext): Awaitable<PresentationOperation>;
  fallbackAfterEditError?(error: unknown): Awaitable<"replace" | "throw">;
}

export interface ClosePlanContext {
  readonly instance: Readonly<InstanceRecord>;
  readonly surface: SurfaceReference;
}

export interface CloseStrategy {
  readonly id: string;
  plan(context: ClosePlanContext): Awaitable<CloseOperation>;
}
