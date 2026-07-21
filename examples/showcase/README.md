# Showcase bot

This example keeps the important MVP scenarios in one place:

- `/profile` — a member-scoped dialog with navigation, localized text, text input and photo input;
- `/poll` — a chat-scoped dialog that every group member may use;
- `/counter` — a dialogless window with a reusable stateful keyboard widget;
- `/report` — a dialogless photo window;
- `sendReportFromBackground` — sending the same window with `bot.api` outside an incoming update.

The plugin configuration also demonstrates automatic presentation fallback,
detaching keyboards on close, and reply-aware routing between active inputs.
The counter and report windows omit ViewModel entirely; TSX text automatically uses Telegram HTML mode.

The example uses the preferred immutable `DialogKit` composition model:

- `Counter` demonstrates `defineWidget` and direct reuse as an exported JSX component;
- dialogs use nested local-window builders while presentation is declared with TSX;
- each dialog keeps its layout in `index.tsx` and state/load/intents in `view-model.ts`;
- navigation and intents use serializable `go`, `back`, and `intent` actions in JSX buttons;
- `Photo` demonstrates media and `Counter` uses the persisted stateful-widget runtime;
- `dialogDsl.define(...)` collects ordinary application resources once;
- plugin extensions remain reserved for reusable third-party contributions;
- `appDialogs.middleware(...)` registers every collected resource without a manual `list`.

Create the bot and start grammY from your application entrypoint:

```ts
import { createShowcaseBot } from "./bot.js";

const { bot } = createShowcaseBot(process.env.BOT_TOKEN!);
bot.start();
```

The example itself is included in the repository typecheck.
