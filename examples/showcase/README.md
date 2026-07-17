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

Create the bot and start grammY from your application entrypoint:

```ts
import { createShowcaseBot } from "./bot.js";

const { bot } = createShowcaseBot(process.env.BOT_TOKEN!);
bot.start();
```

The example itself is included in the repository typecheck.
