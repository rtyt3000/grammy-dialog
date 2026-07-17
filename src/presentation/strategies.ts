import type {
  CloseStrategy,
  PresentationStrategy,
} from "./contracts.js";

/** Factories for built-in and application-defined presentation strategies. */
export interface PresentationStrategies {
  /** Edits compatible surfaces and replaces incompatible or uneditable ones. */
  auto(): PresentationStrategy;
  /** Prefers editing and optionally replaces the surface after an edit failure. */
  edit(options?: { fallback?: "replace" | "throw" }): PresentationStrategy;
  /** Sends a replacement and removes the previous surface. */
  replace(): PresentationStrategy;
  /** Sends a new surface while retaining the previous message without callbacks. */
  send(): PresentationStrategy;
  /** Uses an application-defined presentation planner. */
  custom(strategy: PresentationStrategy): PresentationStrategy;
}

function telegramDescription(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const candidate = error as { description?: unknown; message?: unknown; error_code?: unknown };
  if (candidate.error_code !== undefined && candidate.error_code !== 400) return "";
  const description = typeof candidate.description === "string"
    ? candidate.description
    : typeof candidate.message === "string"
      ? candidate.message
      : "";
  return description.toLowerCase();
}

/** Returns whether a Telegram edit error is safe to recover through replacement. */
export function isRecoverableEditError(error: unknown): boolean {
  const description = telegramDescription(error);
  return description.includes("message to edit not found") ||
    description.includes("message can't be edited") ||
    description.includes("message can not be edited");
}

function canEditInPlace(current: string, next: string): boolean {
  if (current === "text" || next === "text") return current === next;
  return current !== "voice" && next !== "voice";
}

/** Built-in surface presentation strategies. */
export const presentations: PresentationStrategies = {
  auto() {
    return {
      id: "auto",
      plan: ({ current, nextKind }) => canEditInPlace(current.kind, nextKind) ? "edit" : "replace",
      fallbackAfterEditError: error => isRecoverableEditError(error) ? "replace" : "throw",
    };
  },
  edit(options = {}) {
    return {
      id: "edit",
      plan: ({ current, nextKind }) => canEditInPlace(current.kind, nextKind) ? "edit" : "replace",
      fallbackAfterEditError: () => options.fallback ?? "throw",
    };
  },
  replace() {
    return { id: "replace", plan: () => "replace" };
  },
  send() {
    return { id: "send", plan: () => "send" };
  },
  custom(strategy) {
    return strategy;
  },
};

/** Factories for built-in and application-defined close strategies. */
export interface CloseStrategies {
  /** Leaves the final surface untouched. */
  keep(): CloseStrategy;
  /** Removes callbacks but keeps the message. This is the runtime default. */
  detach(): CloseStrategy;
  /** Deletes the final Telegram message. */
  delete(): CloseStrategy;
  /** Uses an application-defined close planner. */
  custom(strategy: CloseStrategy): CloseStrategy;
}

/** Built-in instance close strategies. */
export const closeStrategies: CloseStrategies = {
  keep: () => ({ id: "keep", plan: () => "keep" }),
  detach: () => ({ id: "detach", plan: () => "detach" }),
  delete: () => ({ id: "delete", plan: () => "delete" }),
  custom: strategy => strategy,
};
