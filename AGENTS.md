# AGENTS.md

## Project overview

`@ppsh/grammy-dialog` is an experimental TypeScript library for building declarative, MVVM-inspired Telegram interfaces on top of grammY. It is a library package, not a standalone bot. Its single public API is exported through `src/index.ts`; custom widget factories are available through DialogKit extensions.

The repository uses Bun for scripts and tests, TypeScript in strict mode, ESM, and NodeNext-compatible `.js` specifiers in TypeScript source files.

## Repository map

- `src/definitions/`: public definitions and low-level factories.
- `src/kit/`: the recommended DialogKit DSL, extensions, and built-in widgets.
- `src/runtime/`: dialog orchestration, rendering, focus, input matching, and surfaces.
- `src/persistence/`: storage contracts and dialog repository.
- `src/presentation/`, `src/input-routing/`, `src/policies/`: independent runtime strategies.
- `src/integration/`: grammY middleware integration.
- `src/callbacks/`: callback encoding and decoding.
- `test/`: Bun runtime and behavior tests.
- `type-tests/`: compile-time checks for public API and package exports.
- `examples/showcase/`: representative integration patterns.
- `docs/architecture.md`: architectural decisions and domain model. Keep it aligned with material design changes.
- `mod.ts`: JSR-facing root entrypoint.

## Working conventions

- Preserve the separation between Model/services, ViewModel, persisted state, Window/View, rendering, and runtime orchestration described in `docs/architecture.md`.
- Persist only compact, serializable state. Do not store grammY contexts, services, functions, ViewModels, or rendered messages in dialog records.
- Keep policy concerns composable: scope, access, input routing, presentation, and close behavior are separate strategies.
- Treat callback routing, access checks, storage revisions, and keyed locking as correctness-sensitive paths. Add focused regression tests for changes in these areas.
- Use `import type` for type-only imports and retain `.js` extensions for relative imports from TypeScript files.
- Follow the existing formatting: two-space indentation, double quotes, semicolons, trailing commas in multiline constructs, and multiline imports when helpful. There is currently no formatter or linter script; avoid unrelated formatting churn.
- Prefer explicit public types and keep generic inference intact. Avoid `any` unless an existing compatibility boundary requires it.
- Add concise TSDoc to new public APIs and non-obvious runtime operations.

## Public API and compatibility

- When adding or changing a public symbol, update `src/index.ts` and verify the root JSR entrypoint remains correct.
- Keep package exports limited to the main entrypoint unless the change intentionally expands the supported surface.
- Add or update tests in `type-tests/` for type-level behavior and export changes.
- Update `README.md`, examples, and `docs/architecture.md` when user-facing behavior, defaults, or architectural decisions change. These documents are written primarily in Russian; preserve their language and UTF-8 encoding.
- Do not hand-edit generated output in `dist/`. Regenerate it with the build script.

## Testing

Run the narrowest relevant test while iterating:

```bash
bun test test/<relevant-file>.test.ts
```

Before handing off a code change, run the complete validation pipeline:

```bash
bun run check
```

This performs the main typecheck, public API type tests, Bun tests, declaration/JavaScript build, and package-consumer smoke typecheck. For documentation-only changes, a careful diff review is sufficient.

Tests should cover observable behavior and failure modes. Use the existing `bun:test`, `grammy-testing`, and helpers in `test/helpers.ts`; keep tests deterministic and independent of real Telegram or network access.

## Change discipline

- Inspect the working tree before editing and preserve unrelated user changes.
- Keep changes scoped; do not refactor adjacent modules unless required by the task.
- Avoid committing generated artifacts unless the task or repository workflow explicitly requires them.
- Never publish the package, change its version, or alter release automation unless explicitly requested.
