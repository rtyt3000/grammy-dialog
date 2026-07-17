# grammy-dialog

Экспериментальная TypeScript-библиотека декларативных Telegram-интерфейсов для
[grammY](https://grammy.dev/). DialogKit связывает типы контекста и сервисов,
описывает Dialog/Window/ViewModel, собирает расширения и создаёт middleware.

Проект находится на стадии раннего MVP, поэтому публичный API может меняться.
Архитектурные решения и runtime-инварианты описаны в `docs/architecture.md`.

## Установка

```bash
npx jsr add @ppsh/grammy-dialog
# или
npm install jsr:@ppsh/grammy-dialog
```

Пакет имеет один публичный entrypoint:

```ts
import {
  createDialogKit,
  type DialogFlavor,
} from "@ppsh/grammy-dialog";
```

## Быстрый старт

Сначала один раз создаётся application-bound builder:

```ts
import { Bot, type Context } from "grammy";
import {
  createDialogKit,
  type DialogFlavor,
} from "@ppsh/grammy-dialog";

interface Services {
  users: {
    displayName(userId: number): Promise<string>;
  };
}

type BotContext = Context & DialogFlavor;

const builder = createDialogKit<BotContext, Services>();
```

Один Dialog имеет один ViewModel и одно persisted-состояние. Все его окна получают
одинаковые `State`, `View`, `Context` и `Services`:

```ts
interface ProfileState {
  name?: string;
}

const profileVm = builder.viewModel({
  initialState: (): ProfileState => ({}),

  async load({ state, services, actor }) {
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

const profile = builder.dialog("profile", {
  viewModel: profileVm,

  windows: ({ window, ui }) => ({
    main: window("main", {
      text: ({ vm }) => `Profile: ${vm.name}`,
      keyboard: [[ui.button.go("Edit", "edit")]],
    }),

    edit: window("edit", {
      text: "Send a new name",
      keyboard: [[ui.button.back("Back")]],
      input: [
        ui.input.text("name", profileVm.actions.saveName, { trim: true }),
      ],
    }),
  }),
});
```

`profileVm.actions.saveName` — типизированная definition-time ссылка. В callback и
storage сохраняется только имя intent, но переименование и несовместимые input values
проверяются TypeScript.

Standalone Window не требует ViewModel, если ему не нужно состояние:

```ts
const help = builder.window("help", {
  text: "Help",
  parseMode: "HTML",
});
```

Ресурсы регистрируются одной операцией `define()`:

```ts
const app = builder.define(() => ({ profile, help }));

const bot = new Bot<BotContext>(process.env.BOT_TOKEN!);

bot.use(app.middleware({
  services,
  defaults: {
    inputRouting: app.inputRouting.replyOrFocused(),
    presentation: app.presentation.auto(),
    close: app.close.detach(),
  },
}));

bot.command("profile", ctx => ctx.dialog.start(app.dialogs.profile));
bot.command("help", ctx => ctx.ui.show(app.windows.help));
```

## Категории UI

Встроенные элементы не смешиваются с пользовательскими widgets:

```ts
ui.text.key("profile.title");

ui.button.intent("Save", profileVm.actions.saveName);
ui.button.go("Details", "details");
ui.button.replace("Summary", "summary");
ui.button.back("Back");
ui.button.reset("Home", "main");
ui.button.close("Close");
ui.button.url("Docs", "https://example.com");

ui.input.text("name", profileVm.actions.saveName);
ui.input.photo("avatar", profileVm.actions.savePhoto);
ui.input.document("document", uploadVm.actions.receiveDocument);

ui.media.photo("telegram-file-id");
ui.media.video("telegram-file-id");
```

Низкоуровневая callback-кнопка доступна как `ui.button.raw()`.

## Scope, access и keyed instances

Scope отвечает за принадлежность состояния, access — за право взаимодействия:

```ts
const poll = builder.dialog("poll", {
  viewModel: pollVm,
  scope: builder.scope.chat(),
  access: builder.access.everyone(),
  windows: ({ window }) => ({
    main: window("main", { text: "Poll" }),
  }),
});
```

Доступны:

- `scope.member()` — chat + user, значение по умолчанию;
- `scope.chat()` — общее состояние чата;
- `scope.topic()` — отдельное состояние forum topic;
- `scope.custom(resolver)`;
- `access.owner()` — только создатель, значение по умолчанию;
- `access.everyone()`;
- `access.chatAdministrators()`;
- `access.custom(predicate)`.

Внутри scope можно назначить instance пользовательский ключ:

```ts
await ctx.dialog.start(app.dialogs.profile, {
  key: "primary",
  mode: "reuse",
});
```

Collision modes:

- `create` — создать новый instance или вернуть ошибку при коллизии;
- `reuse` — вернуть и перерисовать существующий active instance;
- `replace` — закрыть существующий и создать новый.

Без `key` каждый вызов создаёт независимый instance.

Keyed operations требуют coordinator, который сериализует одну identity между
всеми runtime-процессами:

```ts
app.middleware({
  storage,
  identities: redisIdentityCoordinator,
});
```

Coordinator реализует `run(identity, operation)` и обязан удерживать
распределённую блокировку до завершения operation. Если внешний StorageAdapter не
предоставляет собственное поле `identities` и coordinator не передан явно,
`start/show({ key })` завершится ошибкой. `MemoryStorageAdapter` предоставляет
process-local coordinator, подходящий только когда сам storage не разделяется
между процессами.

## Input routing

Обычное сообщение не содержит callback token, поэтому runtime выбирает один
focused instance через стратегию:

- `replyOrFocused()` — reply имеет приоритет; без reply принимается только один
  однозначный кандидат. Это безопасное значение по умолчанию;
- `reply()` — только явный reply;
- `focused()` — только один focused-кандидат;
- `latest()` / `oldest()` — явный выбор при неоднозначности;
- `replyWithFallback({ fallback })`;
- `custom(strategy)`.

## Пользовательские widgets

Extension не создаёт Bot и не имеет runtime side effects:

```ts
import { defineDialogExtension } from "@ppsh/grammy-dialog";

const counterExtension = defineDialogExtension(({ widget, ui }) => {
  const counter = widget.keyboard({
    state: {
      version: 2,
      initial: (_props: { step?: number }) => 0,
      migrate: (previous, fromVersion) =>
        fromVersion === 1 ? Number(previous) : 0,
    },

    actions: {
      increment({ state, props }) {
        state.update(value => value + (props.step ?? 1));
      },
    },

    render({ state, actions }) {
      return [[
        ui.button.raw(String(state.value), actions.increment()),
      ]];
    },
  });

  return { widgets: { counter } };
});

const extended = createDialogKit<BotContext, Services>()
  .use(counterExtension);
```

`widgets` содержит только установленные пользовательские компоненты. Несколько
stateful widgets можно поместить в одну клавиатуру:

```ts
keyboard: ui.keyboard.compose(
  widgets.counter("left", { step: 1 }),
  widgets.counter("right", { step: 10 }),
);
```

`id` является namespace persisted-состояния. Дублирование id в одном дереве
клавиатуры считается ошибкой. При изменении `state.version` вызывается `migrate`,
а без migration состояние инициализируется заново.

## Runtime и persistence

В storage сохраняются только сериализуемые данные: stack, dialog state, locale,
surface reference, widget state, revisions, callbacks, focus и keyed identity.
grammY Context, сервисы, функции, ViewModel и render result не сохраняются.

Runtime по умолчанию использует memory storage. Для production передайте любой
совместимый grammY `StorageAdapter<DialogStorageRecord>` в `middleware()`.
Для keyed instances в multi-process deployment также обязателен распределённый
`IdentityCoordinator`.

Основные defaults:

- locale `en`;
- member scope и owner access;
- `replyOrFocused()` input routing;
- `presentation.auto()`;
- `close.detach()`;
- callback TTL 7 дней;
- максимальная глубина stack 32.

Максимальную глубину можно изменить через `maxStackDepth`.

## Проверка проекта

```bash
bun run check
```

Команда запускает основной typecheck, public API type tests, Bun tests, build и
package-consumer smoke typecheck. Showcase находится в `examples/showcase`.
