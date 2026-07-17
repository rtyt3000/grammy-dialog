import {
  button,
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
