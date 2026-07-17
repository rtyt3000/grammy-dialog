import {
  button,
  createDialogKit,
  defineDialogExtension,
  dialogs,
  MemoryStorageAdapter,
  window,
  type DialogStorageRecord,
} from "@ppsh/grammy-dialog";
import { defineKeyboardWidget } from "@ppsh/grammy-dialog/widgets";

const widget = defineKeyboardWidget<{}, number>()({
  state: { initial: () => 0 },
  actions: { increment({ state }) { state.update(value => value + 1); } },
  render: ({ state, actions }) => [[button(String(state.value), actions.increment())]],
});

const exportedWindow = window("package-smoke", {
  text: "Package smoke",
  parseMode: "HTML",
  keyboard: widget({ id: "counter" }),
});

dialogs({
  list: [exportedWindow],
  storage: new MemoryStorageAdapter<DialogStorageRecord>(),
});

const extension = defineDialogExtension(() => ({
  widgets: { badge: (text: string) => `Badge: ${text}` },
}));
const dsl = createDialogKit().use(extension);
const notice = dsl.window("notice", { text: "Notice" });
const nested = dsl.dialog("nested", ({ window }) => ({
  windows: { main: window("main", { text: "Nested" }) },
}));
const kit = dsl.compose(() => ({ notice, nested }));
kit.widgets.badge("ready");
kit.widgets.intent("Save", "save");
kit.widgets.back("Back");
kit.widgets.switchTo("Next", "next");
kit.widgets.cancel("Cancel");
kit.dialogs.nested;
kit.windows.notice;
kit.middleware({});
