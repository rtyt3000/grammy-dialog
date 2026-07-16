# grammy-dialog

Экспериментальная TypeScript-библиотека для построения декларативных Telegram-интерфейсов поверх [grammY](https://grammy.dev/), вдохновлённая aiogram-dialog.

Проект находится на стадии проектирования API. Текущая архитектура описана в [docs/architecture.md](docs/architecture.md).

## Цели

- декларативные окна, навигация и переиспользуемые widgets;
- несколько одновременно активных диалогов в одном scope;
- dialogless-окна без создания полноценного Dialog;
- MVVM-подобное разделение View, ViewModel и сохраняемого состояния;
- работа в личных чатах, группах и forum topics;
- встроенная точка расширения для любой i18n-системы;
- простое создание сторонних text, keyboard, media и input widgets;
- совместимость с хранилищами экосистемы grammY.

## Предполагаемое подключение

```ts
import { Bot, type Context } from "grammy";
import {
  dialogs,
  type DialogFlavor,
} from "grammy-dialog";

type BotContext = Context & DialogFlavor;

const bot = new Bot<BotContext>(token);

const dialogPlugin = dialogs({
  list: [
    profileDialog,
    groupPollDialog,
    notificationWindow,
  ],
  storage,
  i18n,
});

bot.use(dialogPlugin);
```

После установки middleware управление доступно через context:

```ts
bot.command("profile", ctx => ctx.dialog.start("profile"));

bot.command("notification", ctx =>
  ctx.ui.show("notification", {
    data: { kind: "welcome" },
  }),
);
```

Dialogless-окна должны быть доступны и вне входящего update:

```ts
await dialogPlugin.runtime.show("notification", {
  api: bot.api,
  chatId,
  actorId: userId,
  data: { kind: "reminder" },
});
```

Приведённый API является черновым и будет проверен type-only прототипом до реализации runtime.

