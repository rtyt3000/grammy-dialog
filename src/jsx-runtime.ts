export { Fragment, jsx, jsxs } from "./jsx/runtime.js";
export type { JsxElement, JsxNode } from "./jsx/types.js";

import type { JsxComponent, JsxElement, JsxNode } from "./jsx/types.js";

interface HtmlChildren {
  readonly children?: JsxNode;
}
interface AnchorProps extends HtmlChildren {
  readonly href: string;
}

interface CodeProps extends HtmlChildren {
  readonly className?: string;
}

interface BlockquoteProps extends HtmlChildren {
  readonly expandable?: boolean;
}

export namespace JSX {
  export type Element = JsxElement;
  export type ElementType = keyof IntrinsicElements | JsxComponent<any>;
  export interface ElementChildrenAttribute {
    children: {};
  }
  export interface IntrinsicAttributes {
    readonly key?: string | number;
  }
  export interface IntrinsicElements {
    readonly a: AnchorProps;
    readonly b: HtmlChildren;
    readonly blockquote: BlockquoteProps;
    readonly br: {};
    readonly code: CodeProps;
    readonly del: HtmlChildren;
    readonly em: HtmlChildren;
    readonly i: HtmlChildren;
    readonly ins: HtmlChildren;
    readonly pre: HtmlChildren;
    readonly s: HtmlChildren;
    readonly strong: HtmlChildren;
    readonly "tg-spoiler": HtmlChildren;
    readonly u: HtmlChildren;
  }
}
