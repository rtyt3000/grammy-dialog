import { Button, Row, defineWidget } from "@ppsh/grammy-dialog";

/** Reusable stateful counter widget mounted as a JSX component. */
export const Counter = defineWidget<{ step?: number }, number>()({
  state: {
    initial: () => 0,
  },
  actions: {
    decrement({ state, props }) {
      state.update((value) => value - (props.step ?? 1));
    },
    increment({ state, props }) {
      state.update((value) => value + (props.step ?? 1));
    },
  },
  render: ({ state, actions }) => (
    <Row>
      <Button action={actions.decrement()}>-</Button>
      <Button action={actions.increment()}>{state.value}</Button>
      <Button action={actions.increment()}>+</Button>
    </Row>
  ),
});
