# Архитектура grammy-dialog

Статус: реализованный ранний MVP. Документ описывает фактическую модель, а не
планируемый API.

## 1. Назначение

`grammy-dialog` — декларативный UI runtime для Telegram-ботов на grammY.
Библиотека управляет навигацией, сериализуемым UI-состоянием, callbacks, input
routing и обновлением Telegram messages. Единственная публичная точка построения
приложения — `createDialogKit()`.

## 2. Доменные границы

```text
Model/services       бизнес-данные приложения
        ↓
Dialog ViewModel     state, load и intents одного workflow
        ↓
Window               TSX View, media и inputs
        ↓
WindowRenderer       definition + state → RenderedWindow
        ↓
SurfaceManager       RenderedWindow → Telegram message
        ↓
DialogRuntime        routing, locks, focus и persistence coordination
```

Главная runtime-сущность — независимый `InstanceRecord`. В одном scope может
одновременно существовать несколько instances.

## 3. Dialog, ViewModel и Window

### Dialog

Dialog задаёт workflow, единый ViewModel, набор окон, initial window и политики:

```tsx
const profile = builder.dialog("profile", {
  viewModel: profileVm,
  scope: builder.scope.member(),
  access: builder.access.owner(),
  windows: ({ window }) => ({
    main: window("main", { view: <Text>Profile</Text> }),
    edit: window("edit", { view: <Text>Edit profile</Text> }),
  }),
});
```

Локальные runtime ids автоматически получают префикс: `profile.main`,
`profile.edit`.

### Единый владелец состояния

У Dialog ровно один ViewModel и одно persisted-состояние. Все окна этого Dialog
имеют одинаковые `State`, `View`, `Context` и `Services`. При навигации state не
меняет схему и не переинициализируется.

Это исключает ситуацию, когда Window B получает state, созданный ViewModel окна A.

```ts
interface ViewModelDefinition<State, View> {
  initialState(): State;
  load(context): Awaitable<View>;
  intents: Record<string, IntentHandler>;
  actions: Record<string, IntentReference>;
}
```

ViewModel definition существует только в registry. В storage сохраняется `State`,
но не ViewModel, функции, services или grammY Context.

### Window

Window — декларативное представление:

- `view` с чистым TSX-деревом текста, одного media attachment, keyboard и input bindings;
- optional низкоуровневый список input bindings вне TSX;
- optional access override.

Standalone Window имеет собственный ViewModel. Для статического окна DialogKit
подставляет пустой identity-ViewModel.

### TSX View

`view` — основной presentation-контракт Window. Он принимает `RenderContext` и возвращает
чистое JSX-дерево. JSX renderer отвечает только за преобразование дерева в текст, media и keyboard;
регистрация callbacks, проверка revision/access и Telegram I/O остаются в `WindowRenderer`
и `SurfaceManager`.

```tsx
view: ({ vm }) => (
  <Window>
    <Text>Профиль: <B>{vm.name}</B></Text>
    <Keyboard>
      <Row>
        <Button action={intent(profileVm.actions.edit)}>Изменить</Button>
      </Row>
    </Keyboard>
  </Window>
)
```

JSX-компоненты и их props являются definition/runtime данными и не сохраняются. Callback
кнопка содержит сериализуемый `ButtonAction`, а не closure. Минимальный TSX runtime не имеет
собственного lifecycle, состояния или Telegram API: persisted hooks и stateful components
должны в дальнейшем опираться на `InstanceRecord`, стабильный component key и ревизии.

`Widget` уже позволяет смонтировать существующий `KeyboardWidgetInstance` в JSX keyboard.
Его versioned state и actions обслуживаются прежним runtime; JSX не создаёт параллельное хранилище.

Переход на TSX — breaking change: поля Window `text`, `parseMode`, `media` и `keyboard`
удалены, а `view` является единственным presentation-контрактом. При миграции `text`
переносится в `<Text>`, media — в соответствующий `<Photo>`/`<Video>`/другой media-element,
keyboard — в `<Keyboard>`, а форматирование описывается typed JSX-элементами. Renderer
всегда формирует Telegram HTML, поэтому отдельный `parseMode` больше не настраивается.

## 4. Persisted instance

Упрощённая структура:

```ts
interface InstanceRecord {
  id: string;
  kind: "dialog" | "standalone";
  definitionId: string;
  ownerId?: number;
  chatId: number;
  threadId?: number;
  scopeKey: string;
  key?: string;
  stack: StackFrame[];
  state: unknown;
  widgetStates: Record<string, VersionedState>;
  locale: string;
  revision: number;
  status: "active" | "closed";
  surface?: SurfaceReference;
  callbackTokens: string[];
  focusedUserIds: number[];
  result?: unknown;
}
```

`StackFrame` содержит только `windowId` и optional navigation data. Максимальная
глубина stack по умолчанию равна 32 и проверяется до `go()`.

## 5. Instance transitions

Навигация отделена от I/O в `InstanceTransitions`:

- `go` добавляет frame;
- `replace` заменяет верхний frame;
- `back` удаляет frame или закрывает instance в корне;
- `reset` создаёт новый корневой frame;
- `close` переводит instance в closed и сохраняет result.

Transitions валидируют window reference и stack limit, но не работают с Telegram
или storage.

## 6. Scope, access и identity

Scope отвечает за принадлежность состояния:

```text
member  → chat + user
chat    → chat
topic   → chat + message thread
custom  → application resolver
```

Access отвечает за взаимодействие с уже созданным instance:

```text
owner                 только создатель
everyone              любой actor того же чата
chatAdministrators    creator/administrator по данным Telegram
custom                 application predicate
```

Scope и access не объединяются. Например, chat-scoped poll может быть доступен
всем, а chat-scoped moderation dialog — только администраторам.

### Keyed identity

`start/show` могут получить `key`. Полная identity состоит из:

```text
scopeKey + definitionId + user key
```

Отдельная versioned storage-запись связывает identity с instance id. Операции с
одной identity целиком выполняются внутри `IdentityCoordinator.run()`.

Collision modes:

- `create` — ошибка при active collision;
- `reuse` — access check, focus и rerender существующего instance;
- `replace` — закрытие существующего и создание нового.

Coordinator обязан быть распределённым, если StorageAdapter разделяется между
процессами. Runtime не разрешает keyed start/show без coordinator. StorageAdapter
может предоставить его через поле `identities`, либо приложение передаёт
`identities` в middleware options.

При ошибке initial mount identity освобождается внутри той же critical section.
После обычного закрытия запись может остаться tombstone: следующий keyed start
читает instance status и безопасно заменяет её, всё ещё удерживая coordinator.

## 7. Focus и input routing

Callback содержит точный instance token. Обычное сообщение адреса не содержит,
поэтому focus хранится отдельно для каждого `chat/thread/user` как упорядоченный
список instance ids.

Безопасный default `replyOrFocused`:

1. найти instance по replied-to surface;
2. иначе принять единственного focused-кандидата;
3. при нескольких кандидатах не обрабатывать update.

Дополнительно реализованы `reply`, `focused`, `latest`, `oldest`,
`replyWithFallback` и custom strategy.

Текстовый input валидируется после нормализации `trim`. Успешный результат может
заменить значение перед вызовом intent; неуспешный результат потребляет update,
не вызывает intent и отправляет локализуемое сообщение об ошибке. Валидация может
быть асинхронной и выполняется под instance lock вместе с обработкой input.

Focus commit сериализуется отдельным keyed lock. Если subsequent instance commit
падает, предыдущий focus snapshot восстанавливается.

## 8. Callbacks и revisions

Production callback data содержит только непрозрачный token. Callback record
хранит:

```ts
interface CallbackRecord {
  instanceId: string;
  revision: number;
  action: ButtonAction;
  chatId: number;
  expiresAt?: number;
}
```

Перед выполнением проверяются:

- наличие и TTL callback record;
- active instance;
- совпадение revision;
- chat id и surface message id;
- текущая access policy.

После успешного события revision увеличивается. Старые callbacks перестают быть
валидными даже до физического удаления records.

## 9. Выполнение actions

`ActionExecutor` отвечает только за mutation in-memory snapshot:

- загружает View через dialog-level ViewModel;
- выполняет intent;
- находит вложенный stateful widget и выполняет его action;
- делегирует navigation в `InstanceTransitions`.

Он не пишет storage и не вызывает Telegram API. Commit, rerender и recovery
остаются ответственностью `DialogRuntime`.

## 10. Rendering и surfaces

`WindowRenderer` за один pass разрешает:

1. ViewModel view;
2. text/translation;
3. media source;
4. keyboard tree;
5. callback records.

`SurfaceManager` применяет render через presentation strategy:

- `auto` — edit совместимого surface, иначе replace;
- `edit` — edit с configurable fallback;
- `replace` — новое сообщение с удалением старого;
- `send` — новое сообщение с detach старой клавиатуры.

Close strategies: `keep`, `detach`, `delete`.

Storage commit является границей успешной операции. При ошибках реализованы
best-effort компенсации:

- удаление orphan message после неуспешного initial persistence;
- удаление replacement после неуспешного commit;
- rollback in-place edit к persisted snapshot;
- сохранение уже committed replacement при ошибке cleanup.

## 11. Widget tree

Raw keyboard rows и stateful widgets образуют дерево через
JSX `Keyboard`, `Row` и компоненты, созданные `defineWidget`. Renderer рекурсивно объединяет rows.

Widget может вернуть другой mounted widget. Renderer рекурсивно раскрывает такое дерево
одинаково при presentation render и callback lookup, строит единый индекс mounted widgets
и проверяет уникальность `id` среди top-level и всех вложенных компонентов.

Состояние widget хранится по mounted `id`:

```ts
widgetStates[id] = { version, value };
```

Правила:

- id обязан быть уникальным в одном rendered keyboard tree;
- version по умолчанию `1`;
- при несовпадении version вызывается optional `migrate`;
- без migration используется `initial(props)`;
- widget actions используют тот же instance lock и revision lifecycle.

## 12. Типизированные intent references

ViewModel создаёт `actions` из ключей `intents`. Intent reference содержит runtime
name и type-only параметры Payload/Value. Buttons и inputs принимают reference:

```tsx
<Button action={intent(vm.actions.openUser, { userId: 42 })}>Open</Button>

bind.photo("avatar", vm.actions.savePhoto);
```

В persisted callback/input binding остаётся строковое имя; функции и references
не сохраняются.

## 13. DialogKit

DialogKit — единственный публичный construction API:

```text
createDialogKit<C, Services>()
        ↓
use(extension) / extend(factory)
        ↓
dialog(...) + standalone window(...)
        ↓
define(() => resources)
        ↓
typed dialogs/windows catalogs
        ↓
middleware(options)
```

Категории:

- `bind` — standalone input bindings;
- `defineWidget` — stateful JSX components;
- `scope`, `access`, `presentation`, `close`, `inputRouting` — strategies.

Kit immutable: `use`, `extend` и `define` возвращают новый объект. При композиции
немедленно проверяются duplicate catalog names, resource ids и initial windows.

Низкоуровневые factories и `dialogs({ list })` остаются внутренними деталями и не
экспортируются package entrypoint.

## 14. Concurrency и ограничения

Реализованы in-process locks:

- instance id — сериализация callbacks/input одного instance;
- focus key — commit/recovery focus;
- scoped identity — внешний `IdentityCoordinator`, распределённый для shared storage.

Instance и focus locks остаются in-process. Identity является исключением:
create/reuse/replace требуют внешнего distributed coordinator при shared storage.

Пока не реализованы:

- distributed locks и атомарные multi-key transactions;
- albums и multi-message surfaces;
- автоматический cleanup истёкших callbacks и закрытых instances;
- migration dialog state между версиями приложения;
- durable outbox для необратимых Telegram side effects.

## 15. Проверка

`bun run check` последовательно выполняет:

1. основной TypeScript typecheck;
2. public API type tests;
3. Bun runtime tests;
4. declaration/JavaScript build;
5. package-consumer smoke typecheck.

Correctness-sensitive изменения callbacks, revisions, access, focus, identity,
locking и compensation должны сопровождаться отдельными regression tests.
