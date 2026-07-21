---
name: use-grammy-dialog
description: Build, refactor, review, and debug type-safe Telegram dialog interfaces with the experimental @ppsh/grammy-dialog TypeScript library and grammY. Use for DialogKit setup, ViewModels, dialogs and standalone windows, typed intents and inputs, navigation, middleware, persistence, scope/access/presentation/input-routing policies, i18n, background rendering, and custom DialogKit extensions or widgets. Do not use for grammY-only bots that do not use @ppsh/grammy-dialog.
---

# Use grammy-dialog

Build against the package's single public entrypoint and preserve its MVVM and persistence boundaries. Prefer the high-level, immutable DialogKit DSL over internal factories.

## Establish the API version

Treat the library as experimental and verify the installed or checked-out version before coding.

- In this repository, inspect `src/index.ts`, the relevant public contracts, `README.md`, and `examples/showcase/`.
- In a consumer project, inspect the installed declarations for `@ppsh/grammy-dialog` and its package version.
- Import application APIs only from `@ppsh/grammy-dialog`; never depend on package internals.
- Retain `.js` specifiers on relative TypeScript imports when editing this repository.

## Choose the resource model

- Use a Dialog for a multi-window workflow with one shared ViewModel, state, and navigation stack.
- Use a standalone Window for an independent surface. Omit its ViewModel when it is static.
- Use a custom widget for reusable UI behavior nested inside windows.
- Export reusable widgets as JSX components; use extensions to package registered dialogs/windows for multiple DialogKits.

Read [core-dialogs.md](references/core-dialogs.md) for setup, ViewModels, windows, typed intents/inputs, registration, middleware, and i18n.

## Implement in dependency order

1. Define `AppContext = Context & DialogFlavor` and the injected services interface.
2. Create one application-bound `createDialogKit<AppContext, Services>()`.
3. Define ViewModels before windows so windows can use typed `viewModel.actions` references.
4. Define dialogs and standalone windows.
5. Register ordinary application resources with `kit.define()` and keep the returned kit.
6. Install `app.middleware(...)` before handlers that call `ctx.dialog` or `ctx.ui`.
7. Start registered dialogs through `ctx.dialog.start(app.dialogs.name)` and show standalone windows through `ctx.ui.show(app.windows.name)`.

Do not discard the result of `use`, `extend`, or `define`; DialogKit composition is immutable.

## Preserve correctness boundaries

- Persist only compact serializable state. Never store grammY contexts, services, functions, ViewModels, intent references, or rendered messages.
- Keep business data and I/O in injected services; keep persisted UI state in the ViewModel; derive render data in `load`; declare presentation in windows.
- Use `state.update(...)` in intents instead of mutating state directly.
- Pass `viewModel.actions.someIntent` to intent buttons and inputs. Add an explicit `IntentContext` annotation when payload/value inference needs help.
- Keep scope ownership separate from access authorization.
- Prefer `replyOrFocused()` unless ambiguous input routing is an intentional product decision.
- Require a shared `IdentityCoordinator` for keyed instances when storage is shared across processes.

Read [runtime-policies.md](references/runtime-policies.md) when configuring storage, keyed instances, scope/access, input routing, presentation/close behavior, callbacks, or background sends.

## Extend deliberately

Keep ordinary app dialogs/windows in `define()`. Use `defineDialogExtension()` for portable third-party-style registered resources, or `kit.extend()` for app-local resources. Give each mounted stateful widget a stable ID unique within its rendered keyboard tree, and provide migration logic when changing its persisted state version.

Read [extensions-widgets.md](references/extensions-widgets.md) before creating custom widgets or extensions.

## Validate

- Add behavior tests for runtime changes and type tests for public typing or export changes.
- In this repository, run the narrowest Bun test while iterating, then run `bun run check` before handoff.
- In a consumer project, run its TypeScript check and focused bot tests; do not require real Telegram or network access for deterministic tests.
- Update `README.md`, examples, and `docs/architecture.md` when changing user-visible behavior or architectural decisions in this repository.
