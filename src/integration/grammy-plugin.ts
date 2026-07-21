import type { Context, MiddlewareFn } from "grammy";
import { DialogRuntime } from "../runtime/dialog-runtime.js";
import type {
  DialogFlavor,
  DialogRuntimeOptions,
} from "../runtime/contracts.js";

/** grammY middleware augmented with its reusable dialog runtime. */
export type DialogPlugin<
  C extends Context = Context,
  Services = unknown,
> = MiddlewareFn<C> & {
  readonly runtime: DialogRuntime<C, Services>;
};

/**
 * Creates grammY middleware that installs `ctx.dialog` and `ctx.ui`, then routes
 * callbacks and focused inputs before delegating unmatched updates downstream.
 */
export function dialogs<C extends Context = Context, Services = unknown>(
  options: DialogRuntimeOptions<C, Services>,
): DialogPlugin<C, Services> {
  const runtime = new DialogRuntime(options);
  const middleware: MiddlewareFn<C> = async (ctx, next) => {
    const flavored = ctx as C & DialogFlavor;
    flavored.dialog = runtime.controller(ctx);
    flavored.ui = runtime.uiController(ctx);

    if (await runtime.handleCallback(ctx)) return;
    if (await runtime.handleInput(ctx)) return;
    await next();
  };

  return Object.assign(middleware, { runtime });
}
