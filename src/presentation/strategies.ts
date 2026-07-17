import type {
  CloseStrategy,
  PresentationStrategy,
} from "./contracts.js";

export interface PresentationStrategies {
  auto(): PresentationStrategy;
  edit(options?: { fallback?: "replace" | "throw" }): PresentationStrategy;
  replace(): PresentationStrategy;
  send(): PresentationStrategy;
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

export interface CloseStrategies {
  keep(): CloseStrategy;
  detach(): CloseStrategy;
  delete(): CloseStrategy;
  custom(strategy: CloseStrategy): CloseStrategy;
}

export const closeStrategies: CloseStrategies = {
  keep: () => ({ id: "keep", plan: () => "keep" }),
  detach: () => ({ id: "detach", plan: () => "detach" }),
  delete: () => ({ id: "delete", plan: () => "delete" }),
  custom: strategy => strategy,
};
