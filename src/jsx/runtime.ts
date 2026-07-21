import type { JsxComponent, JsxElement } from "./types.js";

/** Fragment marker used by the automatic JSX runtime. */
export const Fragment = Symbol.for("@ppsh/grammy-dialog.Fragment");

type ElementType = string | symbol | JsxComponent<any>;

/** Creates one immutable JSX element. Called by TypeScript's automatic runtime. */
export function jsx(
  type: ElementType,
  props: Record<string, unknown> | null,
  key?: string | number,
): JsxElement {
  return Object.freeze({
    type,
    props: Object.freeze(props ?? {}),
    ...(key === undefined ? {} : { key }),
  });
}

/** Automatic-runtime alias used for JSX nodes with multiple static children. */
export const jsxs = jsx;

/** Development-runtime variant with the same observable element format. */
export function jsxDEV(
  type: ElementType,
  props: Record<string, unknown> | null,
  key?: string | number,
): JsxElement {
  return jsx(type, props, key);
}
