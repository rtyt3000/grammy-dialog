# Core DialogKit workflows

## Contents

- Bind application types
- Define a ViewModel
- Define a dialog
- Define standalone windows
- Register and install
- Use built-in UI
- Add i18n
- Common mistakes

## Bind application types

Create one DSL instance that binds the grammY context and application services:

```ts
import type { Context } from "grammy";
import {
  createDialogKit,
  type DialogFlavor,
} from "@ppsh/grammy-dialog";

interface Services {
  users: {
    displayName(userId: number): Promise<string>;
  };
}

type AppContext = Context & DialogFlavor;

export const dialogDsl = createDialogKit<AppContext, Services>();
```

Keep services out of persisted state. The middleware injects them into ViewModel loaders, intents, and render sources.

## Define a ViewModel

Use an identity ViewModel when the rendered view is the state. Add `load` when rendering needs derived data or service calls.

```ts
interface ProfileState {
  name?: string;
}

interface ProfileView {
  name: string;
}

export const profileViewModel = dialogDsl.viewModel({
  initialState: (): ProfileState => ({}),

  async load({ actor, services, state }): Promise<ProfileView> {
    return {
      name: state.name ?? await services.users.displayName(actor.id ?? 0),
    };
  },

  intents: {
    saveName({ state, value, navigation }) {
      state.update(current => ({ ...current, name: String(value) }));
      navigation.back();
    },
  },
});
```

When an input value or callback payload must be explicit, annotate the handler parameter with the exported `IntentContext<C, State, View, Services, Payload, Value>` type. For attachment inputs, use the exported normalized value type such as `PhotoInputValue` or `FileInputValue`.

Use `initialState: () => value` when each instance needs freshly created nested values. A literal initial state is cloned by the runtime factory, but a factory makes the ownership obvious.

## Define a dialog

A dialog owns exactly one ViewModel. Every local window shares its State, View, Context, and Services types.

```tsx
export const profileDialog = dialogDsl.dialog("profile", {
  viewModel: profileViewModel,

  windows: ({ window }) => {
    const main = window("main", {
      view: ({ vm }) => (
        <Window>
          <Text>Profile: {vm.name}</Text>
          <Keyboard>
            <Row>
              <Button action={go("edit")}>Edit</Button>
            </Row>
          </Keyboard>
        </Window>
      ),
    });

    const edit = window("edit", {
      view: (
        <Window>
          <Text>Send a new name</Text>
          <Keyboard>
            <Row>
              <Button action={back()}>Back</Button>
            </Row>
          </Keyboard>
          <Input>
            <TextInput
              id="name"
              receive={profileViewModel.actions.saveName}
              trim
              validate={value => value.length >= 2
                ? valid(value)
                : invalid("Name is too short")}
            />
          </Input>
        </Window>
      ),
    });

    return { main, edit };
  },
  initial: "main",
});
```

Local runtime window IDs are prefixed with the dialog ID. JSX navigation buttons use actions such as `go(target)`, `replace(target)`, `back()`, `reset(target)`, `close()`, and `intent(viewModel.actions.name, payload)`. URL buttons use `<UrlButton url="...">`.

## Define standalone windows

Use a static standalone window for a dialogless notification or one-screen UI:

```tsx
export const helpWindow = dialogDsl.window("help", {
  view: <Window><Text><B>Help</B></Text></Window>,
});
```

Pass `viewModel` when a standalone window needs independent state. Do not place a dialog's multi-window workflow into multiple standalone windows merely to split files; that would split state and navigation ownership.

## Register and install

Register ordinary application resources once, then use the typed catalogs:

```ts
import { Bot } from "grammy";

export const appDialogs = dialogDsl.define(() => ({
  profile: profileDialog,
  help: helpWindow,
}));

const bot = new Bot<AppContext>(process.env.BOT_TOKEN!);

bot.use(appDialogs.middleware({ services }));

bot.command("profile", ctx => ctx.dialog.start(appDialogs.dialogs.profile));
bot.command("help", ctx => ctx.ui.show(appDialogs.windows.help));
```

Use the catalog key (`profile`, `help`) for compile-time lookup; resource IDs (`"profile"`, `"help"`) are persisted runtime identities. Keep both stable unless a migration plan exists.

## Use built-in UI

Use JSX categories for media, text, keyboard, and inputs:

- Inputs: `text`, `photo`, `video`, `animation`, `audio`, `document`, `voice`, `sticker`, `contact`, `location`, `message`.

Always bind public inputs to a compatible typed intent reference. For example, a photo input requires an intent whose `Value` is `PhotoInputValue`; TypeScript should reject a string-valued intent.

Validate text with the `TextInput` `validate` prop. Return `valid(value)` to accept and optionally normalize the value passed to the intent, or `invalid(message)` to consume the message, skip the intent, and reply with an error. Validation runs after `trim`; both validators and error `TextSource` values may be asynchronous or localized.

Window `view` may be static JSX or derived from render context. Keep render functions free of persisted mutation and irreversible side effects because rerenders may repeat them.

## Add i18n

Call the render context's asynchronous `t(...)` when composing localized JSX:

```tsx
const localized = dialogDsl.window("localized", {
  view: async ({ t }) => <Window><Text><B>{await t("notice.title")}</B></Text></Window>,
});

bot.use(appDialogs.middleware({
  services,
  i18n: {
    adapter: translationAdapter,
    locale: {
      resolve: ctx => ctx.from?.language_code ?? "en",
    },
  },
  defaultLocale: "en",
}));
```

Change an active instance locale with `ctx.dialog.setLocale(instanceId, locale)`; it persists the locale and rerenders.

## Common mistakes

- Do not call `createDialogKit()` separately in each feature file; share one application-bound DSL so types and extensions remain aligned.
- Do not use string intent names in public buttons or input helpers; use `viewModel.actions`.
- Do not manually prefix local window IDs; the dialog factory does it.
- Do not register a dialog's local windows as standalone resources.
- Do not mutate `state` directly or perform service calls during module definition.
- Do not import low-level factories from internal source paths.
