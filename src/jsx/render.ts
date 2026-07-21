import type {
  KeyboardButtonDefinition,
  KeyboardDefinition,
  KeyboardNode,
  KeyboardWidgetInstance,
} from "../definitions/keyboard.js";
import type { ButtonAction } from "../definitions/actions.js";
import type { MediaDefinition } from "../definitions/media.js";
import type { InputDefinition } from "../definitions/input.js";
import {
  BUTTON_ELEMENT,
  INPUT_BINDING_ELEMENT,
  INPUT_ELEMENT,
  KEYBOARD_ELEMENT,
  ROW_ELEMENT,
  TEXT_ELEMENT,
  URL_BUTTON_ELEMENT,
  FORMAT_ELEMENT,
  MEDIA_ELEMENT,
  WIDGET_ELEMENT,
  WINDOW_ELEMENT,
} from "./elements.js";
import { Fragment } from "./runtime.js";
import type { JsxElement, JsxNode } from "./types.js";

/** Presentation values extracted from one JSX view tree. */
export interface RenderedJsxView {
  readonly text: string;
  readonly media?: MediaDefinition;
  readonly keyboard: KeyboardNode;
  readonly inputs: ReadonlyArray<InputDefinition>;
}

const htmlTags = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "i",
  "ins",
  "pre",
  "s",
  "strong",
  "tg-spoiler",
  "u",
]);

function isElement(node: JsxNode): node is JsxElement {
  return (
    typeof node === "object" &&
    node !== null &&
    !Array.isArray(node) &&
    "type" in node
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

async function resolveComponent(element: JsxElement): Promise<JsxNode> {
  return typeof element.type === "function"
    ? element.type(element.props)
    : element;
}

async function renderText(node: JsxNode): Promise<string> {
  const resolved = node;
  if (
    resolved === null ||
    resolved === undefined ||
    typeof resolved === "boolean"
  )
    return "";
  if (
    typeof resolved === "string" ||
    typeof resolved === "number" ||
    typeof resolved === "bigint"
  ) {
    return escapeHtml(String(resolved));
  }
  if (Array.isArray(resolved)) {
    return (await Promise.all(resolved.map(renderText))).join("");
  }
  if (!isElement(resolved)) throw new TypeError("Unsupported JSX text node");
  if (typeof resolved.type === "function")
    return renderText(await resolveComponent(resolved));
  if (resolved.type === Fragment)
    return renderText(resolved.props.children as JsxNode);
  if (resolved.type === FORMAT_ELEMENT) {
    const tag = resolved.props.tag;
    if (typeof tag !== "string" || !htmlTags.has(tag)) {
      throw new TypeError("Unsupported JSX text format element");
    }
    if (tag === "br") return "\n";
    const body = await renderText(resolved.props.children as JsxNode);
    if (tag === "a") {
      const href = resolved.props.href;
      if (typeof href !== "string")
        throw new TypeError("JSX <Link> requires a string href");
      return `<a href="${escapeAttribute(href)}">${body}</a>`;
    }
    if (tag === "code" && typeof resolved.props.className === "string") {
      return `<code class="${escapeAttribute(resolved.props.className)}">${body}</code>`;
    }
    if (tag === "blockquote" && resolved.props.expandable === true) {
      return `<blockquote expandable>${body}</blockquote>`;
    }
    return `<${tag}>${body}</${tag}>`;
  }
  if (resolved.type === "br") return "\n";
  if (typeof resolved.type !== "string" || !htmlTags.has(resolved.type)) {
    throw new TypeError(
      "Only Telegram HTML elements are allowed inside <Text>",
    );
  }

  const body = await renderText(resolved.props.children as JsxNode);
  if (resolved.type === "a") {
    const href = resolved.props.href;
    if (typeof href !== "string")
      throw new TypeError("JSX <a> requires a string href");
    return `<a href="${escapeAttribute(href)}">${body}</a>`;
  }
  if (
    resolved.type === "code" &&
    typeof resolved.props.className === "string"
  ) {
    return `<code class="${escapeAttribute(resolved.props.className)}">${body}</code>`;
  }
  if (resolved.type === "blockquote" && resolved.props.expandable === true) {
    return `<blockquote expandable>${body}</blockquote>`;
  }
  return `<${resolved.type}>${body}</${resolved.type}>`;
}

async function renderButtonText(node: JsxNode): Promise<string> {
  const resolved = node;
  if (
    resolved === null ||
    resolved === undefined ||
    typeof resolved === "boolean"
  )
    return "";
  if (
    typeof resolved === "string" ||
    typeof resolved === "number" ||
    typeof resolved === "bigint"
  ) {
    return String(resolved);
  }
  if (Array.isArray(resolved)) {
    return (await Promise.all(resolved.map(renderButtonText))).join("");
  }
  if (!isElement(resolved)) throw new TypeError("Unsupported JSX button label");
  if (typeof resolved.type === "function")
    return renderButtonText(await resolveComponent(resolved));
  if (resolved.type === Fragment)
    return renderButtonText(resolved.props.children as JsxNode);
  throw new TypeError("Button labels may contain only plain text");
}

async function collectButtons(
  node: JsxNode,
): Promise<KeyboardButtonDefinition[]> {
  const resolved = node;
  if (
    resolved === null ||
    resolved === undefined ||
    typeof resolved === "boolean"
  )
    return [];
  if (Array.isArray(resolved)) {
    return (await Promise.all(resolved.map(collectButtons))).flat();
  }
  if (!isElement(resolved))
    throw new TypeError("A <Row> may contain only buttons");
  if (typeof resolved.type === "function")
    return collectButtons(await resolveComponent(resolved));
  if (resolved.type === Fragment)
    return collectButtons(resolved.props.children as JsxNode);

  const text = await renderButtonText(resolved.props.children as JsxNode);
  if (text.length === 0) throw new TypeError("A JSX button requires a label");
  if (resolved.type === BUTTON_ELEMENT) {
    const action = resolved.props.action;
    if (typeof action !== "object" || action === null || !("kind" in action)) {
      throw new TypeError("A JSX <Button> requires a serializable action");
    }
    return [
      {
        kind: "callback",
        text,
        action: action as ButtonAction,
        ...(typeof resolved.props.id === "string"
          ? { id: resolved.props.id }
          : {}),
      },
    ];
  }
  if (resolved.type === URL_BUTTON_ELEMENT) {
    if (typeof resolved.props.url !== "string") {
      throw new TypeError("A JSX <UrlButton> requires a string url");
    }
    return [{ kind: "url", text, url: resolved.props.url }];
  }
  throw new TypeError("A <Row> may contain only <Button> or <UrlButton>");
}

async function collectKeyboardNodes(node: JsxNode): Promise<KeyboardNode[]> {
  const resolved = node;
  if (
    resolved === null ||
    resolved === undefined ||
    typeof resolved === "boolean"
  )
    return [];
  if (Array.isArray(resolved)) {
    return (await Promise.all(resolved.map(collectKeyboardNodes))).flat();
  }
  if (!isElement(resolved))
    throw new TypeError("A <Keyboard> may contain only <Row> elements");
  if (typeof resolved.type === "function") {
    return collectKeyboardNodes(await resolveComponent(resolved));
  }
  if (resolved.type === Fragment) {
    return collectKeyboardNodes(resolved.props.children as JsxNode);
  }
  if (resolved.type === WIDGET_ELEMENT) {
    const instance = resolved.props.instance;
    if (
      typeof instance !== "object" ||
      instance === null ||
      (instance as { kind?: unknown }).kind !== "keyboard-widget"
    ) {
      throw new TypeError(
        "A JSX <Widget> requires a mounted keyboard widget instance",
      );
    }
    return [instance as KeyboardWidgetInstance<any, any, any, any, any>];
  }
  if (resolved.type !== ROW_ELEMENT) {
    throw new TypeError(
      "A <Keyboard> may contain only <Row> or <Widget> elements",
    );
  }
  const buttons = await collectButtons(resolved.props.children as JsxNode);
  return buttons.length === 0 ? [] : [[buttons]];
}

async function collectInputs(node: JsxNode): Promise<InputDefinition[]> {
  const resolved = node;
  if (
    resolved === null ||
    resolved === undefined ||
    typeof resolved === "boolean"
  )
    return [];
  if (Array.isArray(resolved)) {
    return (await Promise.all(resolved.map(collectInputs))).flat();
  }
  if (!isElement(resolved))
    throw new TypeError("An <Input> may contain only input bindings");
  if (typeof resolved.type === "function")
    return collectInputs(await resolveComponent(resolved));
  if (resolved.type === Fragment)
    return collectInputs(resolved.props.children as JsxNode);
  if (resolved.type !== INPUT_BINDING_ELEMENT) {
    throw new TypeError("An <Input> may contain only input binding elements");
  }
  const definition = resolved.props.definition;
  if (
    typeof definition !== "object" ||
    definition === null ||
    !("kind" in definition)
  ) {
    throw new TypeError("Invalid JSX input binding");
  }
  return [definition as InputDefinition];
}

/** Compiles JSX keyboard children into the runtime's normalized keyboard tree. */
export async function renderJsxKeyboard(node: JsxNode): Promise<KeyboardNode> {
  return {
    kind: "keyboard-group",
    children: await collectKeyboardNodes(node),
  };
}

/** Compiles a pure JSX tree into the existing renderer's presentation contracts. */
export async function renderJsxView(node: JsxNode): Promise<RenderedJsxView> {
  const text: string[] = [];
  const keyboardChildren: KeyboardNode[] = [];
  const inputs: InputDefinition[] = [];
  let media: MediaDefinition | undefined;

  const visit = async (current: JsxNode): Promise<void> => {
    const resolved = current;
    if (
      resolved === null ||
      resolved === undefined ||
      typeof resolved === "boolean"
    )
      return;
    if (Array.isArray(resolved)) {
      for (const child of resolved) await visit(child);
      return;
    }
    if (!isElement(resolved)) {
      text.push(await renderText(resolved));
      return;
    }
    if (typeof resolved.type === "function") {
      await visit(await resolveComponent(resolved));
      return;
    }
    if (resolved.type === Fragment || resolved.type === WINDOW_ELEMENT) {
      await visit(resolved.props.children as JsxNode);
      return;
    }
    if (resolved.type === TEXT_ELEMENT) {
      text.push(await renderText(resolved.props.children as JsxNode));
      return;
    }
    if (resolved.type === KEYBOARD_ELEMENT) {
      keyboardChildren.push(
        ...(await collectKeyboardNodes(resolved.props.children as JsxNode)),
      );
      return;
    }
    if (resolved.type === INPUT_ELEMENT) {
      inputs.push(...(await collectInputs(resolved.props.children as JsxNode)));
      return;
    }
    if (resolved.type === INPUT_BINDING_ELEMENT) {
      throw new TypeError("JSX input bindings must be nested inside <Input>");
    }
    if (resolved.type === MEDIA_ELEMENT) {
      if (media !== undefined)
        throw new TypeError("A JSX view may contain only one media element");
      const source = resolved.props.source;
      if (
        typeof source !== "string" &&
        (typeof source !== "object" || source === null)
      ) {
        throw new TypeError(
          "A JSX media element requires a Telegram file source",
        );
      }
      const kind = resolved.props.kind;
      if (
        kind !== "photo" &&
        kind !== "video" &&
        kind !== "animation" &&
        kind !== "audio" &&
        kind !== "document" &&
        kind !== "voice"
      ) {
        throw new TypeError("Unsupported JSX media kind");
      }
      media = { kind, source } as MediaDefinition;
      return;
    }
    if (typeof resolved.type === "string") {
      text.push(await renderText(resolved));
      return;
    }
    throw new TypeError(
      "JSX rows and buttons must be nested inside <Keyboard>",
    );
  };

  await visit(node);
  return {
    text: text.join(""),
    media,
    keyboard: { kind: "keyboard-group", children: keyboardChildren },
    inputs,
  };
}
