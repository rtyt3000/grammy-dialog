# Showcase bot

This example keeps the important MVP scenarios in one place:

- `/profile` — a member-scoped dialog with navigation, localized text, text input and photo input;
- `/poll` — a chat-scoped dialog that every group member may use;
- `/counter` — a dialogless window with a reusable stateful keyboard widget;
- `/report` — a dialogless photo window;
- `sendReportFromBackground` — sending the same window with `bot.api` outside an incoming update.

The plugin configuration also demonstrates automatic presentation fallback,
detaching keyboards on close, and reply-aware routing between active inputs.
The counter and report windows omit ViewModel entirely; the report caption uses HTML parse mode.

The example uses the preferred immutable `DialogKit` composition model:

- `counterExtension` demonstrates the third-party `defineDialogExtension` DSL;
- dialogs use nested local-window builders;
- each dialog keeps its layout in `index.ts` and state/load/intents in `view-model.ts`;
- navigation uses semantic widgets such as `widgets.intent`, `widgets.go`, and `widgets.back`;
- `appDialogs.compose(...)` collects ordinary application resources once;
- plugin extensions remain reserved for reusable third-party contributions;
- `appDialogs.middleware(...)` registers every collected resource without a manual `list`.

Create the bot and start grammY from your application entrypoint:

```ts
import { createShowcaseBot } from "./bot.js";

const { bot } = createShowcaseBot(process.env.BOT_TOKEN!);
bot.start();
```

The example itself is included in the repository typecheck.
