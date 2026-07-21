# Runtime and policy configuration

## Contents

- Defaults and middleware options
- Scope and access
- Keyed instances
- Input routing
- Presentation and close behavior
- Storage and callbacks
- Background rendering
- Runtime review checklist

## Defaults and middleware options

Configure policies on the kit that owns the registered resources:

```ts
bot.use(appDialogs.middleware({
  services,
  storage,
  defaults: {
    scope: appDialogs.scope.member(),
    access: appDialogs.access.owner(),
    inputRouting: appDialogs.inputRouting.replyOrFocused(),
    presentation: appDialogs.presentation.auto(),
    close: appDialogs.close.detach(),
  },
  callbackTtlMs: 7 * 24 * 60 * 60 * 1000,
  maxStackDepth: 32,
}));
```

These values match the runtime defaults shown above. Override them only to make the application decision explicit or to change behavior.

## Scope and access

Treat scope and access as independent questions:

- Scope decides which actors address the same state: `member()`, `chat()`, `topic()`, or `custom(...)`.
- Access decides who may interact with an existing instance: `owner()`, `everyone()`, `chatAdministrators()`, or `custom(...)`.

For a group poll with shared state:

```tsx
const poll = dialogDsl.dialog("poll", {
  viewModel: pollViewModel,
  scope: dialogDsl.scope.chat<AppContext>(),
  access: dialogDsl.access.everyone<AppContext>(),
  windows: ({ window }) => ({
    main: window("main", { view: <Text>Poll</Text> }),
  }),
});
```

Use member + owner for private per-user workflows. Use chat + everyone only when shared mutation is intended. Use `chatAdministrators()` for moderation flows, accounting for its Telegram API lookup.

## Keyed instances

Use a key when one logical instance must be addressable within `scope + definition`:

```ts
await ctx.dialog.start(appDialogs.dialogs.profile, {
  key: "primary",
  mode: "reuse",
  data: { source: "settings" },
  locale: "en",
});
```

Choose collision behavior deliberately:

- `create`: fail when the key already maps to an active instance.
- `reuse`: authorize, focus, and rerender the existing instance.
- `replace`: close the active instance and create another.

Without `key`, every call creates an independent instance. With shared multi-process storage, pass a distributed `IdentityCoordinator` through `middleware({ identities })`, or use a storage implementation that exposes one. The in-memory adapter's coordinator is process-local only.

## Input routing

Callbacks contain an exact instance token; ordinary messages do not. Select a focused input candidate with one strategy:

- `replyOrFocused()`: prefer a reply; otherwise accept exactly one candidate. Prefer this safe default.
- `reply()`: accept only explicit replies to a rendered surface.
- `focused()`: accept only when exactly one focused candidate exists.
- `latest()` / `oldest()`: resolve ambiguity by focus order.
- `replyWithFallback({ fallback: "latest" | "oldest" | "none" })`.
- `custom(strategy)` for domain-specific routing.

Do not choose latest/oldest merely to hide an ambiguous UX; confirm that silently selecting one workflow is acceptable.

## Presentation and close behavior

Presentation controls how a rerender applies to Telegram:

- `auto()`: edit compatible surfaces and replace incompatible/uneditable ones.
- `edit({ fallback: "replace" | "throw" })`: prefer editing with explicit recovery.
- `replace()`: send a replacement and remove the old surface.
- `send()`: send a new surface and detach callbacks from the old message.
- `custom(strategy)`.

Close behavior controls the final message:

- `keep()`: leave it unchanged.
- `detach()`: remove callbacks but retain the message; this is the default.
- `delete()`: delete it.
- `custom(strategy)`.

Prefer `auto()` + `detach()` for ordinary conversational UI. Use deletion only when disappearing history is an intentional product behavior and Telegram permissions allow it.

## Storage and callbacks

The default memory storage is suitable for tests and single-process ephemeral use. For production, pass a grammY `StorageAdapter<DialogStorageRecord>`.

Persist only runtime records and serializable ViewModel/widget state. Keep context, services, functions, ViewModels, rendered results, and intent references in code. Preserve storage revisions and callback TTL behavior when implementing adapters or codecs.

Callback handling is correctness-sensitive. The runtime checks token existence/TTL, active status, revision, chat/surface identity, and access before execution. Add focused regression tests when changing callback codecs, storage revisions, access, identity coordination, or locking.

## Background rendering

Keep the plugin returned by middleware creation when sending a registered standalone window outside an incoming update:

```ts
import type { Api } from "grammy";
import type { DialogPlugin } from "@ppsh/grammy-dialog";

async function notify(
  plugin: DialogPlugin<AppContext, Services>,
  api: Api,
  chatId: number,
  actorId: number,
) {
  await plugin.runtime.show(appDialogs.windows.help, {
    api,
    chatId,
    actorId,
    locale: "en",
  });
}
```

Supply `threadId` for a forum-topic surface. Background rendering has no incoming grammY context, so ensure loaders/renderers tolerate the documented absence of `ctx` during load and provide the addressing fields they require.

## Runtime review checklist

- Confirm middleware precedes command/callback/input consumers.
- Confirm each resource is registered in the same kit used by middleware.
- Confirm production storage and identity coordination match the deployment topology.
- Confirm shared scopes have an intentional access policy.
- Confirm input ambiguity behavior is intentional.
- Confirm persisted state remains compact and serializable.
- Confirm callback/access/storage/locking changes have regression tests.
