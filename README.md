# grammy-dialog

Экспериментальная TypeScript-библиотека для построения декларативных Telegram-интерфейсов поверх [grammY](https://grammy.dev/), вдохновлённая aiogram-dialog.

Проект находится на стадии раннего MVP. Текущая архитектура описана в [docs/architecture.md](docs/architecture.md).

## Установка

```bash
npmx jsr add @ppsh/grammy-dialog 
# or 
npm install jsr:@ppsh/grammy-dialog
```

Пакет публикует основной entrypoint и отдельный Widget SDK:

```ts
import { dialogs, window } from "@ppsh/grammy-dialog";
import { defineKeyboardWidget } from "@ppsh/grammy-dialog/widgets";
```

## Цели

- декларативные окна, навигация и переиспользуемые widgets;
- несколько одновременно активных диалогов в одном scope;
- dialogless-окна без создания полноценного Dialog;
- MVVM-подобное разделение View, ViewModel и сохраняемого состояния;
- работа в личных чатах, группах и forum topics;
- встроенная точка расширения для любой i18n-системы;
- простое создание сторонних text, keyboard, media и input widgets;
- совместимость с хранилищами экосистемы grammY.

## DialogKit и расширения

Рекомендуемый API собирает типы, widgets, dialogs и standalone windows в одном
immutable kit. Расширения не создают `Bot` и не имеют runtime side effects:

```ts
const dsl = createDialogKit<AppContext, AppServices>();

const calendarExtension = defineDialogExtension(({ define }) => {
  const calendar = define.widget.keyboard<CalendarProps, CalendarState>()({
    state: { initial: () => ({}) },
    actions: { /* ... */ },
    render: () => [],
  });

  return { widgets: { calendar } };
});

const appDsl = dsl.use(calendarExtension);

const profile = appDsl.dialog(
  "profile",
  ({ viewModel, window, widgets }) => {
    const vm = viewModel({
      initialState: (): ProfileState => ({}),
      load: ({ state, services }) => ({
        name: state.name ?? services.profiles.fallbackName,
      }),
    });
    const main = window("main", {
      viewModel: vm,
      input: [
        widgets.textInput("saveName"),
        widgets.calendar({ id: "birthday" }),
      ],
    });
    return { windows: { main } };
  },
);

const report = appDsl.window("report", { text: "Ready" });
const appDialogs = appDsl.compose(() => ({ profile, report }));
```

`dialog(id, builder)` создаёт ViewModel и окна внутри границы диалога. Локальный
`window("main", ...)` автоматически получает runtime id `profile.main`. Обычные
ресурсы приложения собираются одним `.compose()` и не оформляются как extensions.

Готовые и сторонние компоненты доступны из одного типизированного каталога:

```ts
appDialogs.widgets.textInput(...);
appDialogs.widgets.calendar(...);
appDialogs.dialogs.profile;
```

Callback buttons представлены отдельными семантическими widgets, поэтому обычно
не требуется вручную собирать action object:

```ts
widgets.intent("Save", "saveProfile");
widgets.go("Details", "details");
widgets.switchTo("Summary", "summary");
widgets.back("Back");
widgets.reset("Home", "main");
widgets.close("Close");
widgets.cancel("Cancel");
widgets.url("Documentation", "https://example.com");
```

`widgets.button(text, action)` остаётся низкоуровневым escape hatch. Имена
`switchTo` и `cancel` являются удобными aliases для replace-current и close.

ViewModel рекомендуется хранить отдельно от декларации окон:

```text
dialogs/
  profile/
    index.ts        dialog layout и windows
    view-model.ts   state, load и intents
```

Nested dialog builder по-прежнему предоставляет `viewModel` для небольших локальных
диалогов, но не требует определять ViewModel непосредственно внутри callback.

Middleware создаётся один раз и автоматически получает собранный список ресурсов:

```ts
bot.use(appDialogs.middleware({ storage, services, i18n }));
bot.command("profile", ctx =>
  ctx.dialog.start(appDialogs.dialogs.profile),
);
```

`.use()` возвращает новый kit. Коллизии имён каталога, resource id и неверные initial
windows проверяются во время композиции — для установки расширения экземпляр бота
не нужен. Низкоуровневый `dialogs({ list })` остаётся доступен для прямого использования.

## Низкоуровневое подключение

```ts
import { Bot, type Context } from "grammy";
import {
  dialogs,
  type DialogFlavor,
} from "@ppsh/grammy-dialog";

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

Для статического окна ViewModel не нужен. `parseMode` одинаково применяется к
обычному тексту и media caption:

```ts
const helpWindow = window("help", {
  text: "<b>Help</b>",
  parseMode: "HTML",
});
```

## Значения по умолчанию

Обычные случаи не требуют пустого boilerplate:

```ts
const counterVm = viewModel({
  initialState: { count: 0 },
  intents: {
    increment({ state }) {
      state.update(current => ({ count: current.count + 1 }));
    },
  },
});

const counterDialog = defineDialog({
  id: "counter",
  windows: { main: counterWindow }, // первое окно становится initial
});

textInput("saveName"); // вызывает intent "saveName"
```

- у статического `window()` автоматически создаётся пустой ViewModel;
- у `viewModel()` состояние по умолчанию `{}`, `load` возвращает текущее state, а `intents` равен `{}`;
- `defineDialog()` выбирает первое объявленное окно, если `initial` не указан;
- все встроенные и custom input widgets используют свой `id` как `onReceive`;
- schema version состояния keyboard widget равна `1`;
- runtime использует memory storage, locale `en`, member scope, owner access,
  `presentations.auto()`, `closeStrategies.detach()` и `inputRouting.latest()`;
- callbacks по умолчанию непрозрачны, имеют префикс `gd:` и TTL 7 дней.

Поля, определяющие смысл компонента (`id`, button action, media source и actions
stateful-виджета), остаются обязательными.

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
- text, inline keyboard, URL buttons и photo/video/animation/audio/document/voice output;
- text, media, file, sticker, contact, location, raw-message и custom input widgets;
- `go`, `replace`, `back`, `reset`, `close`;
- locale на stack и полностью адаптерный перевод;
- member/chat/topic scope и owner/everyone/custom access;
- auto/edit/replace/send presentation strategies и keep/detach/delete close strategies;
- latest/oldest/reply/custom input routing поверх стека активных instances;
- сериализация focus commit/recovery по ключу chat/topic/user;
- factories для custom text, keyboard, media и input widgets;
- сохраняемое состояние и actions пользовательского keyboard widget;
- локальный lock на уровне instance;
- repository со структурными snapshots независимо от поведения storage adapter;
- компенсация initial send, in-place edit и replacement при ошибке persistence;
- интеграционные тесты через `grammy-testing`.

## Пока не реализовано

- distributed locks и атомарные multi-key storage operations;
- albums и multi-message surfaces;
- миграции widget/instance state;
- автоматический cleanup истёкших callbacks и закрытых instances;
- стабильный publishing/build pipeline.

## Структура MVP

```text
src/
  callbacks/       callback codec
  definitions/     actions, ViewModel, Window, keyboard, media и input contracts
  input-routing/   routing contracts и built-in strategies
  integration/     grammY middleware
  persistence/     storage records и repository
  policies/        scope/access policies
  presentation/    planner, presentation и close strategies
  runtime/         orchestration, rendering, surfaces, locks и input matching
  core.ts          совместимый facade над public definitions
  widgets.ts       стабильный Widget SDK facade
```

Интеграционные тесты разделены по callbacks, navigation/input, groups, topics, media/i18n, widgets, lifecycle и recovery.

Полный компилируемый пример находится в [examples/showcase](examples/showcase): personal/shared dialogs, i18n, text/photo input, stateful widget, routing/presentation defaults и dialogless media window.

Публичный API пока является черновым и может меняться по результатам дальнейших type/runtime тестов.

## Проверка

```bash
bun run typecheck
bun run typecheck:api
bun test
bun run build
```

Полная локальная проверка перед публикацией запускается через `bun run check`.
