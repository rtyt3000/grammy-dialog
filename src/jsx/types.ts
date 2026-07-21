import type { Context } from "grammy";
import type { Awaitable } from "../definitions/common.js";
import type { RenderContext } from "../definitions/rendering.js";

/** A component accepted by the grammy-dialog JSX runtime. */
export type JsxComponent<Props = Record<string, unknown>> = (
  props: Props,
) => Awaitable<JsxNode>;

/** Internal element produced by the automatic JSX runtime. */
export interface JsxElement {
  readonly type: string | symbol | JsxComponent<any>;
  readonly props: Readonly<Record<string, unknown>>;
  readonly key?: string | number;
}

/** Any value that can appear in a grammy-dialog JSX tree. */
export type JsxNode =
  | JsxElement
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | readonly JsxNode[];

/** A static JSX tree or a render-time JSX view function. */
export type JsxViewSource<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> =
  | JsxNode
  | ((context: RenderContext<C, View, Services>) => Awaitable<JsxNode>);
