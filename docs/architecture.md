# Архитектура grammy-dialog

Статус: draft, реализован первый вертикальный MVP.

Этот документ фиксирует принятые архитектурные решения. Конкретные имена типов и функций пока не считаются стабильным публичным API.

## 1. Назначение

`grammy-dialog` — декларативный UI runtime для Telegram-ботов на grammY. Библиотека должна закрывать типовые задачи навигации, хранения UI-состояния, маршрутизации событий, локализации и обновления сообщений, не заставляя разработчика вручную собирать `InlineKeyboard`, кодировать callbacks и регистрировать отдельные handlers.
## 2. Основная модель

```text
Model            бизнес-данные и сервисы приложения
   ↓
ViewModel        подготовка данных и обработка intents
   ↓
Window (View)    декларативные text/media/keyboard/input widgets
   ↓
Renderer         Window → RenderedWindow
   ↓
Surface          одно или несколько Telegram-сообщений
   ↓
Runtime          routing, lifecycle, storage и concurrency
```

Центральная runtime-сущность — `WindowInstance`, а не единственный активный Dialog пользователя.

### Dialog

`Dialog` — статическое описание workflow: начальное окно, доступные окна и правила навигации.

```ts
const profileDialog = defineDialog({
  id: "profile",
  initial: "overview",
  windows: {
    overview: profileWindow,
    editName: editNameWindow,
  },
});
```

### Window

`Window` — декларативное View. Оно не обращается напрямую к storage и не решает, каким Telegram-методом обновлять сообщение.

Для статических Window поле `viewModel` необязательно: factory подставляет пустое
состояние и пустой view. `parseMode` хранится в Window и применяется renderer-ом
к message text либо media caption.

```ts
const profileWindow = window("profile.overview", {
  viewModel: profileViewModel,

  text: ({ vm, t }) =>
    t("profile.title", { name: vm.name }),

  keyboard: [
    [button(t("profile.edit"), "edit")],
    [close(t("common.close"))],
  ],
});
```

### ViewModel

Основной API функциональный. ViewModel создаётся на время обработки update/render и целиком не сохраняется.

```ts
const profileViewModel = viewModel({
  initialState: {
    editing: false,
  },

  async load({ actor, services, state }) {
    const user = await services.users.get(actor.id);

    return {
      name: user.name,
      editing: state.editing,
    };
  },

  intents: {
    async edit({ navigation }) {
      await navigation.go("editName");
    },
  },
});
```

Разделение ответственности:

- Model — бизнес-данные и сервисы;
- ViewModel — вычисляемые данные и обработка intents;
- persisted state — сериализуемое состояние UI;
- Window — чистое описание представления.

## 3. Dialog stack

Каждый dialog instance имеет независимый stack. Frame должен оставаться компактным и сериализуемым.

```ts
interface StackFrame {
  windowId: string;
  data?: unknown;
}

interface DialogStack {
  id: string;
  dialogId: string;
  frames: StackFrame[];
  state: unknown;
  locale: string;
  revision: number;
}
```

В stack нельзя сохранять grammY Context, ViewModel, функции, сервисы или отрендерированные сообщения.

Базовые операции навигации:

```ts
navigation.go("edit");
navigation.replace("success");
navigation.back();
navigation.reset("overview");
instance.close(result);
```

Глубина stack должна иметь настраиваемое ограничение.

## 4. Несколько активных instances

В одном scope может существовать несколько независимых instances:

```text
profile:123       → message 1001
checkout:abc      → message 1015
notification:42   → message 1020
```

Запуск получает пользовательский ключ и collision mode:

```ts
await ctx.dialog.start(checkoutDialog, {
  key: `checkout:${cartId}`,
  mode: "create", // create | reuse | replace
});
```

Callbacks однозначно адресуют instance. Для обычных сообщений используется input routing strategy. Несколько instances могут быть активны одновременно, но неадресованный input не должен случайно обрабатываться всеми.

## 5. Dialogless windows

Dialogless Window использует тот же Window runtime, но не имеет Dialog definition и навигационного графа.

```ts
const handle = await ctx.ui.show(orderCardWindow, {
  key: `order:${order.id}`,
  data: { orderId: order.id },
});

await handle.refresh();
await handle.replace(otherWindow);
await handle.close();
```

Модель:

```text
Dialog Window       = Window + navigation + persisted instance
Dialogless Window   = Window + standalone instance
Static message      = Window без instance после отправки
```

Интерактивное dialogless-окно сохраняет instance, чтобы callbacks продолжали работать после рестарта.

## 6. Подключение к grammY

Основной lifecycle устанавливается одним middleware:

```ts
const plugin = dialogs({
  list: [
    profileDialog,
    checkoutDialog,
    notificationWindow,
  ],
  storage,
  callbacks: callbacks.opaque(),
  i18n,
});

bot.use(plugin);
```

`list` принимает Dialog definitions и самостоятельные dialogless Window definitions. Окна внутри Dialog регистрируются рекурсивно.

Результат `dialogs()` предполагается совместимым с `MiddlewareFn` и одновременно предоставляет runtime для фоновых задач:

```ts
type DialogPlugin<C> = MiddlewareFn<C> & {
  runtime: DialogRuntime<C>;
};
```

Middleware обрабатывает известные dialog callbacks и подходящий input. Остальные updates передаются в `next()`.

## 7. Стратегии

Стратегии разделяются на независимые политики.

### Scope

Отвечает на вопрос: чьё это состояние?

```ts
scope: scopes.member(); // chat + user
scope: scopes.chat();   // общий instance чата
scope: scopes.topic();  // chat + forum topic
scope: scopes.custom(ctx => ({ ... }));
```

### Access

Отвечает на вопрос: кто может воздействовать на instance?

```ts
access: access.owner();
access: access.everyone();
access: access.chatAdministrators();
access: access.custom(async context => true);
```

Scope и access не объединяются: общий chat-scoped Dialog может быть доступен всем или только создателю/администраторам.

### Input routing

Отвечает на вопрос: какому instance передать обычное сообщение?

```ts
input: inputs.reply();
input: inputs.focused();
input: inputs.replyOrFocused();
input: inputs.custom(router);
```

Для групп default-кандидат — `replyOrFocused`. Focus хранится отдельно для каждого участника чата.

При неоднозначности безопасный default — отклонить input, а не обработать его несколькими instances.

### Presentation

Отвечает на вопрос: как применить новый render к Telegram surface?

```ts
presentation: presentations.edit({ fallback: "replace" });
presentation: presentations.replace();
presentation: presentations.send();
presentation: presentations.auto();
```

### Close

Отвечает на вопрос: что оставить после закрытия instance?

```ts
close: closeStrategies.delete();
close: closeStrategies.keep();
close: closeStrategies.detach();
close: close.replaceWith(closedWindow);
```

Стратегии разрешаются по иерархии:

```text
runtime defaults → Dialog → Window → start/show options
```

Декларативный DSL также убирает безопасный boilerplate: статическое окно получает
пустой ViewModel, identity-ViewModel может состоять только из `initialState`, первое
окно Dialog становится `initial`, input вызывает одноимённый с его `id` intent, а
версия состояния keyboard widget равна `1`. Значения, меняющие смысл определения
(`id`, action, media source), не выводятся неявно.

### DialogKit composition

Высокоуровневый `DialogKit<C, Services>` связывает типы приложения один раз и
immutable накапливает три именованных каталога: `widgets`, `dialogs`, `windows`.
Расширение является чистым переиспользуемым contribution и не создаёт grammY Bot.
Обычные ресурсы приложения не являются extensions и собираются через `compose`:

```text
defineDialogExtension / kit.extension
                ↓
          kit.use(extension)
                ↓
 dialog(id, nested builder) + standalone windows
                ↓
          kit.compose(resources)
                ↓
 typed catalogs + validated resources
                ↓
        kit.middleware(options)
                ↓
            grammY Bot
```

`kit.middleware()` передаёт собранные resources низкоуровневому runtime, поэтому
пользователь не дублирует их в `list`. `.use()` возвращает новый kit и немедленно
проверяет коллизии catalog names, dialog/window ids и initial window references.
Nested dialog builder предоставляет `viewModel`, `widgets` и локальный `window`;
локальные ids автоматически получают префикс dialog id.
Готовые third-party widgets и встроенные primitives находятся в одном
`kit.widgets`, а `kit.define.widget.*` является DSL для создания новых компонентов.
Старый `dialogs({ list })` остаётся совместимым низкоуровневым API.

Navigation callback buttons также являются отдельными widgets: `intent`, `go`,
`switchTo`, `back`, `reset`, `close/cancel`, `url`. Низкоуровневый `button` нужен
только для custom `ButtonAction`. Для крупных features рекомендуемая файловая
граница отделяет `view-model.ts` (state/load/intents) от `index.ts` (layout/windows).

## 8. Callbacks

Production callback содержит только непрозрачный случайный token:

```text
gd:Q7qINf4EQLqIUwVZ6GJh9w
```

Рекомендуемый формат — 128 случайных бит в Base64URL. UUID также может поддерживаться стратегией codec.

Debug mode использует читаемую форму с обязательной проверкой лимита Telegram на размер callback data:

```text
gd:profile.overview/edit@3
```

Callback registry связывает token с:

```ts
interface CallbackRecord {
  token: string;
  instanceId: string;
  windowId: string;
  widgetId: string;
  actionId: string;
  revision: number;
  scope: {
    chatId: number;
    messageId?: number;
    allowedUserId?: number;
  };
  payload?: unknown;
  expiresAt?: number;
}
```

Random token скрывает внутренний маршрут, но runtime всё равно проверяет chat, message, user/access policy, revision и expiration.

Новая revision создаёт новые callbacks. Старые callbacks отзываются после успешного обновления Telegram surface. Поддерживаются TTL и одноразовые callbacks.

## 9. Storage

Публичный контракт — стандартный `StorageAdapter` grammY:

```ts
storage?: StorageAdapter<DialogStorageRecord>;
```

Предварительная схема ключей:

```text
gd:instance:<instanceId>
gd:callback:<opaqueToken>
gd:focus:<chatId>:<userId>
gd:scope:<scopeHash>
```

Записи должны быть версионированы и представлены discriminated union.

`StorageAdapter` не гарантирует транзакции или compare-and-swap. Для одного процесса runtime использует lock на уровне instance. Для нескольких процессов может быть предусмотрено необязательное capability-расширение storage с distributed lock/transaction, не ломающее базовую совместимость.

Доступ к адаптеру инкапсулирован в repository. Repository создаёт структурные snapshots на read/write, поэтому корректность runtime не зависит от того, возвращает адаптер копию или ту же ссылку. Distributed consistency, cleanup и атомарные multi-key операции всё ещё требуют проектирования.

## 10. i18n

Core не зависит от конкретного i18n-движка. Используются независимые адаптеры перевода и определения начального языка.

```ts
interface TranslationAdapter {
  translate(
    locale: string,
    key: string,
    params?: Record<string, unknown>,
  ): Awaitable<string>;
}

interface LocaleResolver<C> {
  resolve(ctx: C): Awaitable<string>;
}
```

Можно поставлять отдельные интеграционные пакеты/entrypoints для Fluent, i18next, `@grammyjs/i18n` и других систем, но ни один из них не является обязательным движком core.

Locale хранится на stack. Один render pass использует один locale для текста, подписей кнопок и ошибок validation.

```ts
await ctx.dialog.setLocale("pl", {
  render: "current", // current | all | none
});
```

Default — немедленно сохранить новый locale и перерендерить текущее окно. Все последующие renders используют новое значение без дополнительной renegotiation.

Общий chat-scoped stack имеет один общий язык. Для персонального языка в группе используются member-scoped instances.

## 11. Widget SDK

Поддерживаются четыре основные категории:

```text
TextWidget
KeyboardWidget
MediaWidget
InputWidget
```

Цель SDK — позволить сторонним разработчикам создавать полноценные widgets, не работая напрямую с callback codec, storage, revision и Telegram update routing.

### Композиционные widgets

Stateless widget может быть обычной функцией:

```ts
export function confirmButtons(options: ConfirmOptions) {
  return row(
    button(options.confirmText, options.confirmIntent),
    button(options.cancelText, options.cancelIntent),
  );
}
```

### Stateful widgets

Для widgets с собственным состоянием и событиями используются функциональные factories:

```ts
export const counter = defineKeyboardWidget<CounterProps, number>()({
  state: {
    version: 1,
    initial: props => props.initial ?? 0,
  },

  actions: {
    noop() {},

    decrement({ state, props }) {
      state.update(value =>
        Math.max(props.min ?? -Infinity, value - 1),
      );
    },

    increment({ state, props }) {
      state.update(value =>
        Math.min(props.max ?? Infinity, value + 1),
      );
    },
  },

  render({ state, actions }) {
    return row(
      button("−", actions.decrement()),
      button(String(state.value), actions.noop()),
      button("+", actions.increment()),
    );
  },
});
```

Runtime автоматически namespacе-ит widget state, кодирует actions в opaque callbacks, применяет lock, сохраняет состояние и запускает rerender.

Публичный SDK предполагает отдельный стабильный entrypoint:

```ts
import {
  defineTextWidget,
  defineKeyboardWidget,
  defineMediaWidget,
  defineInputWidget,
} from "@ppsh/grammy-dialog/widgets";
```

Внутренние renderer/storage типы не должны становиться частью Widget API.

## 12. Input widgets

Input widgets не имеют собственного Telegram-представления. Они сопоставляют входящий update, извлекают значение, валидируют его и вызывают intent.

Предполагаемые встроенные widgets:

```text
textInput, photoInput, videoInput, documentInput,
audioInput, voiceInput, animationInput, stickerInput,
contactInput, locationInput, pollInput,
mediaInput, messageInput
```

Пример:

```ts
textInput("name", {
  trim: true,
  validate: value =>
    value.length >= 2
      ? valid(value)
      : invalid(t("profile.name-too-short")),
  onReceive: "nameEntered",
});
```

Результат обработки:

```ts
type InputResult<T> =
  | { type: "accept"; value: T }
  | { type: "reject"; message?: TextSource }
  | { type: "skip" };
```

- `accept` вызывает intent;
- `reject` поглощает update и показывает validation error;
- `skip` передаёт update следующему input widget или middleware.

Custom input создаётся через `defineInputWidget<Props, Value>()` и описывает `match`, `parse`, `validate` и `receive`. Автор widget не занимается маршрутизацией instance и persistence.

Агрегация albums требует отдельного `albumInput` и откладывается после MVP.

## 13. Media widgets и rendering

Media widget декларативно возвращает `MediaSpec`, но не вызывает Telegram API самостоятельно.

```ts
const productCard = window("product.card", {
  text: ({ t, vm }) =>
    t("product.caption", {
      name: vm.name,
      price: vm.price,
    }),

  media: photo(({ vm }) => vm.photoFileId),

  keyboard: [
    [button(t("cart.add"), "addToCart")],
  ],
});
```

Поддерживаемые источники должны включать Telegram file ID, URL и grammY `InputFile`.

Text автоматически становится caption, если Window содержит media. Пользователь не выбирает вручную между message text и caption.

Renderer строит желаемое состояние:

```ts
interface RenderedWindow {
  text?: RenderedText;
  media?: MediaSpec;
  keyboard?: RenderedKeyboard;
  inputs: InputBinding[];
}
```

Presentation strategy превращает разницу между текущей Surface и `RenderedWindow` в одну из операций:

```ts
type SurfaceOperation =
  | { type: "send" }
  | { type: "edit-text" }
  | { type: "edit-caption" }
  | { type: "edit-media" }
  | { type: "replace" }
  | { type: "remove-keyboard" }
  | { type: "delete" }
  | { type: "noop" };
```

Переключение между text-only и media обычно требует replacement. Ошибка редактирования обрабатывается fallback-стратегией.

Media groups создают multi-message surface и требуют отдельной модели для control message. В MVP входят только одиночные media.

## 14. Предполагаемый lifecycle update

```text
Telegram update
      ↓
grammY middleware
      ↓
callback codec или input router
      ↓
выбор конкретного instance
      ↓
instance lock
      ↓
load stack, Window и ViewModel
      ↓
access check
      ↓
handle action/input
      ↓
persist state/navigation
      ↓
render с одним stack locale
      ↓
surface operation
      ↓
save surface/revision/callbacks
```

Текущий порядок side effects использует компенсацию:

- initial send удаляет orphan message, если instance не удалось сохранить;
- незафиксированный in-place edit возвращается к предыдущему render и callback-набору;
- при replacement старое сообщение удаляется только после успешного сохранения нового instance;
- при ошибке replacement persistence новое orphan message удаляется, а старое остаётся активным.

Компенсация является best-effort и не заменяет distributed transaction. Поведение при одновременной недоступности Telegram и storage остаётся открытым вопросом.

## 15. MVP

Первый вертикальный прототип должен включать:

1. `defineWindow`, `defineDialog`, функциональный `defineViewModel`.
2. Text, inline button и одиночный media output.
3. Text и одиночный media input.
4. `start`, `go`, `back`, `replace`, `close`.
5. Несколько instances.
6. Dialogless `ui.show`.
7. Opaque callback registry и debug codec.
8. Memory storage поверх `StorageAdapter`.
9. Locale на stack и абстрактный translation adapter.
10. `defineTextWidget`, `defineKeyboardWidget`, `defineMediaWidget`, `defineInputWidget`.
11. Тестовый renderer без Telegram API.

До реализации runtime следует сделать type-only прототип на четырёх сценариях:

- профиль с навигацией;
- общий групповой опрос;
- dialogless media card;
- пользовательский stateful Counter или Calendar widget.

## 16. Открытые вопросы

Общее направление архитектуры принято. Требуют уточнения:

1. Вывод типов `State`, `StartData`, `Result`, ViewModel intents и widget payload.
2. Финальная структура Stack/Frame/widget state.
3. Storage keys, multi-key consistency, cleanup и multi-process locking.
4. Точный reconciliation для edit/replace/delete и media transitions.
5. Recovery, если основная операция и компенсирующая операция завершаются ошибкой одновременно.
6. TTL callbacks и политика удаления закрытых instances.
7. Albums, media groups и multi-message surfaces.
8. Приоритеты нескольких совпавших input widgets.
9. Версионирование и миграции Dialog, Window и widget state после деплоя.
10. Финальная форма Widget SDK после проверки на реальных сторонних widgets.

## 17. Текущее состояние реализации

Первый вертикальный MVP реализует:

- grammY middleware и внешний runtime handle;
- Dialog/Window/ViewModel registry;
- независимые stacks и несколько instances;
- dialogless Window;
- grammY `StorageAdapter` и memory adapter;
- opaque/debug callback codec, callback records, revision и TTL;
- intent и widget actions;
- text, inline keyboard, URL и photo/video/animation/audio/document/voice rendering;
- auto/edit/replace/send presentation и keep/detach/delete close strategies;
- text/media/file/sticker/contact/location/message/custom inputs и validation;
- latest/oldest/reply/custom input routing по упорядоченному focus record v2;
- locale на stack и translation/locale adapters;
- member/chat/topic scopes;
- owner/everyone/custom access policies;
- factories для text, keyboard, media и input widgets;
- stateful custom keyboard widgets;
- локальный instance lock.

Интеграционные тесты покрывают callback rerender, stack navigation, input, i18n/photo, пользовательский stateful widget и общий групповой Dialog.

Код разделён по каталогам `runtime`, `presentation`, `input-routing`, `persistence`, `callbacks`, `policies` и `integration`. Showcase отдельно раскладывает dialogs, standalone windows, widgets, i18n и services. Интеграционные suites покрывают lifecycle, recovery, presentation strategies, несколько focus candidates и расширенные media/input типы.
