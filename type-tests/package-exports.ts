import {
  createDialogKit,
  defineDialogExtension,
  MemoryStorageAdapter,
  type DialogStorageRecord,
} from "@ppsh/grammy-dialog";

const counterExtension = defineDialogExtension(({ widget, ui }) => {
  const counter = widget.keyboard({
    state: { initial: (_props: {}) => 0 },
    actions: { increment({ state }) { state.update(value => value + 1); } },
    render: ({ state, actions }) => [[
      ui.button.raw(String(state.value), actions.increment()),
    ]],
  });
  return { widgets: { counter } };
});

const builder = createDialogKit().use(counterExtension);
const nested = builder.dialog("nested", {
  viewModel: builder.viewModel({ initialState: {} }),
  windows: ({ window, ui, widgets }) => ({
    main: window("main", {
      text: "Nested",
      keyboard: ui.keyboard.compose(
        widgets.counter("first", {}),
        widgets.counter("second", {}),
      ),
    }),
  }),
});
const notice = builder.window("notice", { text: "Notice" });
const app = builder.define(() => ({ nested, notice }));

app.middleware({ storage: new MemoryStorageAdapter<DialogStorageRecord>() });
app.ui.media.photo("file-id");
app.dialogs.nested;
app.windows.notice;
