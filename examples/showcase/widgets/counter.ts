import { button } from "@ppsh/grammy-dialog";
import { defineKeyboardWidget } from "@ppsh/grammy-dialog/widgets";

export const counterWidget = defineKeyboardWidget<{ step?: number }, number>()({
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
      button("−", actions.decrement()),
      button(String(state.value), actions.increment()),
      button("+", actions.increment()),
    ]];
  },
});
