import { describe, expect, test } from "bun:test";
import {
  backButton,
  closeButton,
  createDialogKit,
  goButton,
  intentButton,
  replaceButton,
  resetButton,
} from "../src/internal.js";

describe("semantic button widgets", () => {
  test("create intent and navigation actions", () => {
    expect(intentButton("Save", "save", { payload: { source: "button" } }).action)
      .toEqual({ kind: "intent", name: "save", payload: { source: "button" } });
    expect(goButton("Open", "details", { data: 42 }).action)
      .toEqual({ kind: "go", windowId: "details", data: 42 });
    expect(replaceButton("Switch", "summary").action)
      .toEqual({ kind: "replace", windowId: "summary", data: undefined });
    expect(backButton("Back").action).toEqual({ kind: "back" });
    expect(resetButton("Home", "main").action)
      .toEqual({ kind: "reset", windowId: "main", data: undefined });
    expect(closeButton("Cancel", { result: "cancelled" }).action)
      .toEqual({ kind: "close", result: "cancelled" });
  });

  test("exposes aiogram-style names through the kit widget catalog", () => {
    const buttons = createDialogKit().ui.button;

    expect(buttons.back("Back").action.kind).toBe("back");
    expect(buttons.replace("Switch", "next").action.kind).toBe("replace");
    expect(buttons.close("Cancel").action.kind).toBe("close");
    expect(buttons.url("Docs", "https://example.com").kind).toBe("url");
  });
});
