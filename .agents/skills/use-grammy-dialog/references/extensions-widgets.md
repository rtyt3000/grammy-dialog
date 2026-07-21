# JSX widgets and DialogKit extensions

## Contents

- Create a stateful JSX widget
- Mount stateful widgets
- Version persisted widget state
- Use extensions for resources
- Review checklist

## Create a stateful JSX widget

Reusable UI behavior is a JSX component, not a DialogKit catalog entry. Define it with `defineWidget(...)`:

```tsx
import { Button, Row, defineWidget } from "@ppsh/grammy-dialog";

export const Counter = defineWidget<{ step?: number }, number>()({
  state: {
    version: 1,
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

  render: ({ state, actions }) => (
    <Row>
      <Button action={actions.decrement()}>-</Button>
      <Button action={actions.increment()}>{state.value}</Button>
      <Button action={actions.increment()}>+</Button>
    </Row>
  ),
});
```

Widget definitions must not create a Bot or perform runtime side effects. They describe state, actions, and JSX render output only.

## Mount stateful widgets

Mount a widget with a stable `id` prop and ordinary component props inside a JSX keyboard:

```tsx
const counterCard = dialogDsl.window("counter-card", {
  view: (
    <Window>
      <Text>Counters</Text>
      <Keyboard>
        <Counter id="left" step={1} />
        <Counter id="right" step={10} />
      </Keyboard>
    </Window>
  ),
});
```

The mounted `id` namespaces persisted widget state. Keep it stable across rerenders and releases, and make it unique within one rendered keyboard tree. Duplicate IDs are errors.

A widget may render another stateful widget. Nested widgets participate in the same expanded keyboard tree: their callbacks are resolved normally, and their IDs must be unique across both top-level and nested mounts.

## Version persisted widget state

Increment `state.version` when changing the stored value's schema. Migrate old values explicitly:

```ts
state: {
  version: 2,
  initial: (_props: { step?: number }) => ({ count: 0 }),
  migrate(previous, fromVersion) {
    if (fromVersion === 1) return { count: Number(previous) };
    return { count: 0 };
  },
},
```

Without a migration, a version mismatch reinitializes widget state. Keep migration pure, deterministic, and tolerant of malformed legacy data.

## Use extensions for resources

Use `defineDialogExtension(...)`, `kit.extension(...)`, or `kit.extend(...)` for reusable registered dialogs/windows. Do not use extensions to register JSX widgets; export widget components directly.

```tsx
const extension = defineDialogExtension(({ dialog, viewModel }) => {
  const help = dialog("plugin-help", {
    viewModel: viewModel({ initialState: {} }),
    windows: ({ window }) => ({
      main: window("main", { view: <Text>Plugin help</Text> }),
    }),
  });

  return { dialogs: { help } };
});
```

Avoid collisions: DialogKit validates duplicate catalog names, duplicate resource IDs, and invalid initial-window references during composition.

## Review checklist

- Confirm widgets export only through package public APIs.
- Confirm widget definitions have no Bot creation, network work, or runtime side effects.
- Confirm widget mount IDs are unique and stable.
- Confirm state schema changes increment the version and include migration when preservation matters.
- Confirm action handlers update state through the provided handle.
- Confirm contributed resource IDs and catalog names cannot collide unexpectedly.
- Add type tests for inferred widget props/actions and behavior tests for state/action/migration behavior.
