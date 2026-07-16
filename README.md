# grammy-dialog

Экспериментальная TypeScript-библиотека для построения декларативных Telegram-интерфейсов поверх [grammY](https://grammy.dev/), вдохновлённая aiogram-dialog.

Проект находится на стадии раннего MVP. Текущая архитектура описана в [docs/architecture.md](docs/architecture.md).

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
  i18n: {
    adapter: translationAdapter,
    locale: localeResolver,
  },
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

## Реализовано в MVP

- `dialogs()` как grammY middleware и runtime для фоновой отправки;
- `Dialog`, `Window`, функциональный ViewModel и независимый stack каждого instance;
- несколько одновременно активных instances и dialogless `ui.show()`;
- opaque/debug callback codec, callback registry, revision и TTL;
- `StorageAdapter` grammY и встроенный memory adapter;
- text, inline keyboard, URL buttons и одиночный photo output;
- focused text/photo input с validation;
- `go`, `replace`, `back`, `reset`, `close`;
- locale на stack и полностью адаптерный перевод;
- member/chat/topic scope и owner/everyone/custom access;
- factories для custom text, keyboard, media и input widgets;
- сохраняемое состояние и actions пользовательского keyboard widget;
- локальный lock на уровне instance;
- repository со структурными snapshots независимо от поведения storage adapter;
- компенсация initial send, in-place edit и replacement при ошибке persistence;
- интеграционные тесты через `grammy-testing`.

## Пока не реализовано

- distributed locks и атомарные multi-key storage operations;
- полноценные presentation/close/input-routing strategies;
- albums и multi-message surfaces;
- media types кроме photo;
- миграции widget/instance state;
- автоматический cleanup истёкших callbacks и закрытых instances;
- стабильный publishing/build pipeline.

## Структура MVP

```text
src/
  core.ts          публичные definitions и базовые типы
  plugin.ts        grammY middleware
  runtime.ts       orchestration lifecycle
  registry.ts      registry Dialog/Window definitions
  repository.ts    типизированная граница StorageAdapter
  renderer.ts      Window → RenderedWindow
  surface.ts       Telegram send/edit/replace и compensation
  input.ts         сопоставление и нормализация input
  callbacks.ts     opaque/debug callback codec
  locks.ts         локальная сериализация операций instance
  storage.ts       persisted records и memory adapter
  strategies.ts    scope/access policies
  widgets.ts       Widget SDK factories
```

Интеграционные тесты разделены по callbacks, navigation/input, groups, topics, media/i18n, widgets, lifecycle и recovery.

Публичный API пока является черновым и может меняться по результатам дальнейших type/runtime тестов.

## Проверка

```bash
bun run typecheck
bun test
```
