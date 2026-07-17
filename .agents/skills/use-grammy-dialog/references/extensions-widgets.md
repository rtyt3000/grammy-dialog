# DialogKit extensions and custom widgets

## Contents

- Choose an extension mechanism
- Create a portable extension
- Compose stateful widgets
- Version persisted widget state
- Contribute resources
- Extension review checklist

## Choose an extension mechanism

- Use `defineDialogExtension(...)` for a portable extension that binds to an application's Context and Services when installed.
- Use `kit.extension(...)` when defining a reusable extension against one already-typed kit.
- Use `kit.extend(...)` for an app-local extension that should be defined and installed in one operation.
- Use `kit.define(...)` for ordinary application dialogs/windows. Do not disguise app resources as plugins.

All composition methods are immutable. Assign or export the returned kit.

## Create a portable extension

Build a stateful keyboard widget with the extension DSL:

```ts
import { defineDialogExtension } from "@ppsh/grammy-dialog";

export const counterExtension = defineDialogExtension(({ widget, ui }) => {
  const counter = widget.keyboard({
    state: {
      version: 1,
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
```

Install it before defining resources that use it:

```ts
export const dialogDsl = createDialogKit<AppContext, Services>()
  .use(counterExtension);
```

An extension definition must not create a Bot or perform runtime side effects. It contributes declarative factories/resources.

## Compose stateful widgets

Mount a widget with a stable ID and props:

```ts
const counterCard = dialogDsl.window("counter-card", {
  text: "Counters",
  keyboard: dialogDsl.ui.keyboard.compose(
    dialogDsl.widgets.counter("left", { step: 1 }),
    dialogDsl.widgets.counter("right", { step: 10 }),
  ),
});
```

The mounted ID namespaces persisted widget state. Keep it stable across rerenders and releases, and make it unique within one rendered keyboard tree. Duplicate IDs are errors.

Use built-in buttons inside widget renderers through `ui.button.raw(...)` with the generated widget action. Use `ui.keyboard.compose(...)` to combine raw rows and nested custom widgets.

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

## Contribute resources

An extension may return `widgets`, `dialogs`, and `windows`. Use this for genuinely reusable registered resources whose IDs and semantics belong to the extension. Avoid collisions: DialogKit validates duplicate catalog names, duplicate resource IDs, and invalid initial-window references during composition.

Use an app-local extension when it needs widgets already installed on the kit:

```ts
const extended = dialogDsl.extend(({ widgets, window }) => ({
  windows: {
    summary: window("summary", {
      text: "Summary",
      keyboard: widgets.counter("summary-count", { step: 1 }),
    }),
  },
}), { name: "summary" });
```

Use the returned `extended.windows.summary` and `extended.middleware(...)`; the original `dialogDsl` remains unchanged.

## Extension review checklist

- Confirm the extension exports only through the package's public entrypoint APIs.
- Confirm definition has no Bot creation, network work, or runtime side effects.
- Confirm widget mount IDs are unique and stable.
- Confirm state schema changes increment the version and include migration when preservation matters.
- Confirm action handlers update state through the provided handle.
- Confirm contributed resource IDs and catalog names cannot collide unexpectedly.
- Add type tests for inferred widget props/actions and behavior tests for state/action/migration behavior.
