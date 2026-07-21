# grammy-dialog

[![Agent Skill](https://skills.sh/b/rtyt3000/grammy-dialog)](https://skills.sh/rtyt3000/grammy-dialog)

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

## AI Agent Skill

Репозиторий содержит переносимый
[Agent Skill](https://agentskills.io/specification) для разработки интерфейсов
на `@ppsh/grammy-dialog`. Установщик [`skills`](https://skills.sh/docs/cli)
поддерживает Claude Code, Cursor, Codex, GitHub Copilot, Gemini CLI, OpenCode и
другие совместимые агенты.

Установка через pnpm:

```bash
pnpm dlx skills add rtyt3000/grammy-dialog --skill use-grammy-dialog
```

Или через npm:

```bash
npx skills add rtyt3000/grammy-dialog --skill use-grammy-dialog
```

По умолчанию CLI определит доступные агенты и предложит место установки. Для
глобальной установки добавьте `--global`, а нужные агенты можно указать явно:

```bash
pnpm dlx skills add rtyt3000/grammy-dialog \
  --skill use-grammy-dialog \
  --global \
  --agent claude-code \
  --agent cursor \
  --agent codex \
  --agent github-copilot
```

После установки попросите агента использовать `use-grammy-dialog` либо опишите
задачу естественным языком, например: «Создай chat-scoped опрос на
`@ppsh/grammy-dialog`». Способ явного вызова зависит от конкретного агента.

## Быстрый старт

Сначала один раз создаётся application-bound builder:

```ts
import { Bot, type Context } from "grammy";
import {
  Button,
  Input,
  Keyboard,
  Row,
  Text,
  TextInput,
  Window,
  back,
  createDialogKit,
  go,
  invalid,
  valid,
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

```tsx
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

  windows: ({ window }) => ({
    main: window("main", {
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
    }),

    edit: window("edit", {
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
              receive={profileVm.actions.saveName}
              trim
              validate={value => value.length >= 2
                ? valid(value)
                : invalid("Имя слишком короткое")}
            />
          </Input>
        </Window>
      ),
    }),
  }),
});
```

`validate` вызывается после `trim`. `valid(value)` принимает ввод и может передать в intent
нормализованное значение; `invalid(message)` не вызывает intent и отправляет пользователю ошибку.
Валидатор может быть асинхронным, а сообщение — локализуемым `TextSource`.

`profileVm.actions.saveName` — типизированная definition-time ссылка. В callback и
storage сохраняется только имя intent, но переименование и несовместимые input values
проверяются TypeScript.

Standalone Window не требует ViewModel, если ему не нужно состояние:

```tsx
const help = builder.window("help", {
  view: <Window><Text>Help</Text></Window>,
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

## TSX View

Окно может описывать presentation через TSX. Это новый основной View API: JSX компилируется
напрямую в `RenderedWindow` и не использует definition DSL для построения текста или клавиатуры.

Добавьте automatic JSX runtime в `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@ppsh/grammy-dialog"
  }
}
```

```tsx
import {
  B,
  Button,
  Input,
  Keyboard,
  Row,
  Text,
  TextInput,
  Window,
  intent,
} from "@ppsh/grammy-dialog";

const counter = builder.window("counter", {
  viewModel: counterVm,
  view: ({ vm }) => (
    <Window>
      <Text>Счёт: <B>{vm.count}</B></Text>
      <Keyboard>
        <Row>
          <Button action={intent(counterVm.actions.increment)}>+1</Button>
        </Row>
      </Keyboard>
    </Window>
  ),
});
```

Текстовые значения автоматически экранируются и отправляются с `parse_mode: "HTML"`.
Поддерживаются `Fragment`, sync/async-компоненты, Telegram HTML-теги, `Text`, `Photo`,
`Keyboard`, `Row`, `Button`, `UrlButton` и монтирование stateful-виджета через `Widget`.
`Button` принимает сериализуемый `ButtonAction`; callback
не хранит closure и продолжает использовать проверки instance revision, scope и access.

Переход на TSX — breaking change: прежние поля Window `text`, `parseMode`, `media` и
`keyboard` удалены. Перенесите их содержимое соответственно в `<Text>`, media-elements и
`<Keyboard>` внутри `view`; Telegram HTML используется автоматически. Input bindings можно
объявлять через `<Input>` в JSX, а низкоуровневое поле `input` сохранено для программных
bindings. Policies остаются свойствами Window/Dialog.

## Категории UI

Встроенные элементы не смешиваются с пользовательскими widgets:

```tsx
<Text>{await t("profile.title")}</Text>

<Button action={intent(profileVm.actions.saveName)}>Save</Button>
<Button action={go("details")}>Details</Button>
<Button action={replace("summary")}>Summary</Button>
<Button action={back()}>Back</Button>
<Button action={reset("main")}>Home</Button>
<Button action={close()}>Close</Button>
<UrlButton url="https://example.com">Docs</UrlButton>

<Photo source="telegram-file-id" />
<Video source="telegram-file-id" />
```

```ts
input: [
  bind.text("name", profileVm.actions.saveName, { trim: true }),
  bind.photo("avatar", profileVm.actions.savePhoto),
];
```

## Scope, access и keyed instances

Scope отвечает за принадлежность состояния, access — за право взаимодействия:

```tsx
const poll = builder.dialog("poll", {
  viewModel: pollVm,
  scope: builder.scope.chat(),
  access: builder.access.everyone(),
  windows: ({ window }) => ({
    main: window("main", { view: <Text>Poll</Text> }),
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

Widget definition не создаёт Bot и не имеет runtime side effects:

```tsx
import { Button, Row, defineWidget } from "@ppsh/grammy-dialog";

const Counter = defineWidget<{ step?: number }, number>()({
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

  render: ({ state, actions }) => (
    <Row>
      <Button action={actions.increment()}>{state.value}</Button>
    </Row>
  ),
});
```

`Counter` — обычный экспортируемый JSX-компонент, а не элемент каталога DialogKit.
Несколько stateful widgets можно поместить в одну клавиатуру:

```tsx
<Keyboard>
  <Counter id="left" step={1} />
  <Counter id="right" step={10} />
</Keyboard>
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
