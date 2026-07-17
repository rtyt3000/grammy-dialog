import { defineDialogExtension } from "@ppsh/grammy-dialog";

/** Third-party-style extension contributing a stateful counter widget. */
export const counterExtension = defineDialogExtension(({ define }) => {
  const counter = define.widget.keyboard<{ step?: number }, number>()({
    state: {
      initial: () => 0,
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
        define.button("−", actions.decrement()),
        define.button(String(state.value), actions.increment()),
        define.button("+", actions.increment()),
      ]];
    },
  });

  return { widgets: { counter } };
}, { name: "counter" });
