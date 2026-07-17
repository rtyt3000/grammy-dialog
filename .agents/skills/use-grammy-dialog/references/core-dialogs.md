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

```ts
export const profileDialog = dialogDsl.dialog("profile", {
  viewModel: profileViewModel,

  windows: ({ window, ui }) => {
    const main = window("main", {
      text: ({ vm }) => `Profile: ${vm.name}`,
      keyboard: [[ui.button.go("Edit", "edit")]],
    });

    const edit = window("edit", {
      text: "Send a new name",
      keyboard: [[ui.button.back("Back")]],
      input: [
        ui.input.text("name", profileViewModel.actions.saveName, { trim: true }),
      ],
    });

    return { main, edit };
  },
  initial: "main",
});
```

Local runtime window IDs are prefixed with the dialog ID. Navigation buttons use the local keys returned by `windows`:

- `ui.button.go(text, target)` pushes a frame.
- `ui.button.replace(text, target)` replaces the top frame.
- `ui.button.back(text)` pops a frame and closes at the root.
- `ui.button.reset(text, target)` resets the stack.
- `ui.button.close(text)` closes the instance.
- `ui.button.intent(text, viewModel.actions.name, { payload })` runs an intent.
- `ui.button.url(text, url)` opens a URL.

## Define standalone windows

Use a static standalone window for a dialogless notification or one-screen UI:

```ts
export const helpWindow = dialogDsl.window("help", {
  text: "<b>Help</b>",
  parseMode: "HTML",
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

Use categorized built-ins from the window callback or the kit:

- Text: `ui.text.key(key, params)`.
- Buttons: `raw`, `intent`, `go`, `replace`, `back`, `reset`, `close`, `url`.
- Inputs: `text`, `photo`, `video`, `animation`, `audio`, `document`, `voice`, `sticker`, `contact`, `location`, `message`.
- Media: `photo`, `video`, `animation`, `audio`, `document`, `voice`.
- Keyboard composition: `ui.keyboard.compose(...)`.

Always bind public inputs to a compatible typed intent reference. For example, a photo input requires an intent whose `Value` is `PhotoInputValue`; TypeScript should reject a string-valued intent.

Window `text`, `media`, and keyboard sources may be static or derived from render context. Keep render functions free of persisted mutation and irreversible side effects because rerenders may repeat them.

## Add i18n

Return deferred translations from `ui.text.key(...)`, or call the render context's asynchronous `t(...)` when composing strings:

```ts
const localized = dialogDsl.window("localized", {
  text: async ({ t }) => `<b>${await t("notice.title")}</b>`,
  parseMode: "HTML",
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
