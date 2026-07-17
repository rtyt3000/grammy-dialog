import { defineDialogExtension } from "@ppsh/grammy-dialog";

/** Third-party-style extension contributing a stateful counter widget. */
export const counterExtension = defineDialogExtension(({ widget, ui }) => {
  const counter = widget.keyboard({
    state: {
      initial: (_props: { step?: number }) => 0,
    },
    actions: {
      decrement({ state, props }) {
        state.update(value => value - (props.step ?? 1));
      },
      increment({ state, props }) {
        state.update(value => value + (props.step ?? 1));
      },
    },
    render({ state, actions }) {
      return [[
        ui.button.raw("−", actions.decrement()),
        ui.button.raw(String(state.value), actions.increment()),
        ui.button.raw("+", actions.increment()),
      ]];
    },
  });

  return { widgets: { counter } };
}, { name: "counter" });
