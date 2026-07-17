import { describe, expect, test } from "bun:test";
import {
  backButton,
  closeButton,
  createDialogKit,
  goButton,
  intentButton,
  replaceButton,
  resetButton,
} from "../src/index.js";

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
    const widgets = createDialogKit().widgets;

    expect(widgets.back("Back").action.kind).toBe("back");
    expect(widgets.switchTo("Switch", "next").action.kind).toBe("replace");
    expect(widgets.cancel("Cancel").action.kind).toBe("close");
    expect(widgets.url("Docs", "https://example.com").kind).toBe("url");
  });
});
