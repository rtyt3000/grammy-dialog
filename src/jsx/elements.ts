import type { ButtonAction } from "../definitions/actions.js";
import type { KeyboardWidgetInstance } from "../definitions/keyboard.js";
import type { InputFile } from "grammy";
import type { MediaKind } from "../definitions/media.js";
import type { JsxElement, JsxNode } from "./types.js";
import {
  animationInput,
  audioInput,
  contactInput,
  documentInput,
  locationInput,
  messageInput,
  photoInput,
  stickerInput,
  textInput,
  videoInput,
  voiceInput,
} from "../definitions/input.js";
import type {
  AnimationInputValue,
  AttachmentInputDefinition,
  AudioInputValue,
  ContactInputValue,
  FileInputValue,
  InputDefinition,
  LocationInputValue,
  MessageInputValue,
  PhotoInputDefinition,
  PhotoInputValue,
  StickerInputValue,
  TextInputDefinition,
  VideoInputValue,
  VoiceInputValue,
} from "../definitions/input.js";
import type { IntentReference } from "../definitions/view-model.js";

export const TEXT_ELEMENT = Symbol("grammy-dialog.text");
export const WINDOW_ELEMENT = Symbol("grammy-dialog.window");
export const FORMAT_ELEMENT = Symbol("grammy-dialog.format");
export const INPUT_ELEMENT = Symbol("grammy-dialog.input");
export const INPUT_BINDING_ELEMENT = Symbol("grammy-dialog.input-binding");
export const KEYBOARD_ELEMENT = Symbol("grammy-dialog.keyboard");
export const ROW_ELEMENT = Symbol("grammy-dialog.row");
export const BUTTON_ELEMENT = Symbol("grammy-dialog.button");
export const URL_BUTTON_ELEMENT = Symbol("grammy-dialog.url-button");
export const MEDIA_ELEMENT = Symbol("grammy-dialog.media");
export const WIDGET_ELEMENT = Symbol("grammy-dialog.widget");

function element(type: symbol, props: Record<string, unknown>): JsxElement {
  return { type, props };
}

/** Props shared by JSX elements that contain child nodes. */
export interface ChildrenProps {
  readonly children?: JsxNode;
}

/** Explicit root container for one Telegram window surface. */
export function Window(props: ChildrenProps): JsxElement {
  return element(WINDOW_ELEMENT, { ...props });
}

/** Declares the HTML-formatted body of a Telegram surface. */
export function Text(props: ChildrenProps): JsxElement {
  return element(TEXT_ELEMENT, { ...props });
}

/** Groups non-visual input bindings accepted while this Window is focused. */
export function Input(props: ChildrenProps): JsxElement {
  return element(INPUT_ELEMENT, { ...props });
}

function format(tag: string, props: object): JsxElement {
  return element(FORMAT_ELEMENT, { tag, ...props });
}

/** Bold text inside `<Text>`. */
export function B(props: ChildrenProps): JsxElement {
  return format("b", props);
}

/** Italic text inside `<Text>`. */
export function I(props: ChildrenProps): JsxElement {
  return format("i", props);
}

/** Underlined text inside `<Text>`. */
export function U(props: ChildrenProps): JsxElement {
  return format("u", props);
}

/** Strikethrough text inside `<Text>`. */
export function S(props: ChildrenProps): JsxElement {
  return format("s", props);
}

/** Spoiler text inside `<Text>`. */
export function Spoiler(props: ChildrenProps): JsxElement {
  return format("tg-spoiler", props);
}

/** Inline code inside `<Text>`. */
export function Code(
  props: ChildrenProps & { readonly className?: string },
): JsxElement {
  return format("code", props);
}

/** Preformatted block inside `<Text>`. */
export function Pre(props: ChildrenProps): JsxElement {
  return format("pre", props);
}

/** Block quote inside `<Text>`. */
export function Blockquote(
  props: ChildrenProps & { readonly expandable?: boolean },
): JsxElement {
  return format("blockquote", props);
}

/** Link inside `<Text>`. */
export function Link(
  props: ChildrenProps & { readonly href: string },
): JsxElement {
  return format("a", props);
}

/** Line break inside `<Text>`. */
export function Br(): JsxElement {
  return format("br", {});
}

type ReceiveTarget<Value> = string | IntentReference<any, Value>;

function inputId<Value>(
  receive: ReceiveTarget<Value>,
  explicitId?: string,
): string {
  return explicitId ?? (typeof receive === "string" ? receive : receive.name);
}

function inputBinding(definition: InputDefinition): JsxElement {
  return element(INPUT_BINDING_ELEMENT, { definition });
}

/** Props for a text message input binding. */
export interface TextInputProps {
  readonly receive: ReceiveTarget<string>;
  readonly id?: string;
  readonly trim?: boolean;
  readonly validate?: TextInputDefinition["validate"];
}

/** Accepts text messages while the Window is focused. */
export function TextInput(props: TextInputProps): JsxElement {
  return inputBinding(
    textInput(inputId(props.receive, props.id), {
      onReceive: props.receive,
      trim: props.trim,
      validate: props.validate,
    }),
  );
}

export interface AttachmentInputProps<Value> {
  readonly receive: ReceiveTarget<Value>;
  readonly id?: string;
}

function attachment<Value>(
  factory: (
    id: string,
    options: { readonly onReceive?: ReceiveTarget<Value> },
  ) => InputDefinition,
  props: AttachmentInputProps<Value>,
): JsxElement {
  return inputBinding(
    factory(inputId(props.receive, props.id), { onReceive: props.receive }),
  );
}

/** Accepts photo messages while the Window is focused. */
export function PhotoInput(
  props: AttachmentInputProps<PhotoInputValue>,
): JsxElement {
  return attachment<PhotoInputValue>(photoInput, props);
}

/** Accepts video messages while the Window is focused. */
export function VideoInput(
  props: AttachmentInputProps<VideoInputValue>,
): JsxElement {
  return attachment<VideoInputValue>(videoInput, props) as JsxElement;
}

/** Accepts animation messages while the Window is focused. */
export function AnimationInput(
  props: AttachmentInputProps<AnimationInputValue>,
): JsxElement {
  return attachment<AnimationInputValue>(animationInput, props);
}

/** Accepts audio messages while the Window is focused. */
export function AudioInput(
  props: AttachmentInputProps<AudioInputValue>,
): JsxElement {
  return attachment<AudioInputValue>(audioInput, props);
}

/** Accepts document messages while the Window is focused. */
export function DocumentInput(
  props: AttachmentInputProps<FileInputValue>,
): JsxElement {
  return attachment<FileInputValue>(documentInput, props);
}

/** Accepts voice messages while the Window is focused. */
export function VoiceInput(
  props: AttachmentInputProps<VoiceInputValue>,
): JsxElement {
  return attachment<VoiceInputValue>(voiceInput, props);
}

/** Accepts sticker messages while the Window is focused. */
export function StickerInput(
  props: AttachmentInputProps<StickerInputValue>,
): JsxElement {
  return attachment<StickerInputValue>(stickerInput, props);
}

/** Accepts contact messages while the Window is focused. */
export function ContactInput(
  props: AttachmentInputProps<ContactInputValue>,
): JsxElement {
  return attachment<ContactInputValue>(contactInput, props);
}

/** Accepts location messages while the Window is focused. */
export function LocationInput(
  props: AttachmentInputProps<LocationInputValue>,
): JsxElement {
  return attachment<LocationInputValue>(locationInput, props);
}

/** Accepts any message while the Window is focused. */
export function MessageInput(
  props: AttachmentInputProps<MessageInputValue>,
): JsxElement {
  return attachment<MessageInputValue>(messageInput, props);
}

/** Groups inline-keyboard rows. */
export function Keyboard(props: ChildrenProps): JsxElement {
  return element(KEYBOARD_ELEMENT, { ...props });
}

/** Declares one inline-keyboard row. */
export function Row(props: ChildrenProps): JsxElement {
  return element(ROW_ELEMENT, { ...props });
}

/** Props for a callback button backed by a serializable runtime action. */
export interface ButtonProps extends ChildrenProps {
  readonly action: ButtonAction;
  /** Stable callback hint; row position is used when omitted. */
  readonly id?: string;
}

/** Declares a callback button backed by an intent or navigation action. */
export function Button(props: ButtonProps): JsxElement {
  return element(BUTTON_ELEMENT, { ...props });
}

/** Props for an inline-keyboard URL button. */
export interface UrlButtonProps extends ChildrenProps {
  readonly url: string;
}

/** Declares a button that opens a URL. */
export function UrlButton(props: UrlButtonProps): JsxElement {
  return element(URL_BUTTON_ELEMENT, { ...props });
}

/** Props for a photo attached to the current Telegram surface. */
export interface MediaProps {
  readonly source: string | InputFile;
}

function media(kind: MediaKind, props: MediaProps): JsxElement {
  return element(MEDIA_ELEMENT, { kind, ...props });
}

/** Declares the single photo attachment of a Window. */
export function Photo(props: MediaProps): JsxElement {
  return media("photo", props);
}

/** Declares the single video attachment of a Window. */
export function Video(props: MediaProps): JsxElement {
  return media("video", props);
}

/** Declares the single animation attachment of a Window. */
export function Animation(props: MediaProps): JsxElement {
  return media("animation", props);
}

/** Declares the single audio attachment of a Window. */
export function Audio(props: MediaProps): JsxElement {
  return media("audio", props);
}

/** Declares the single document attachment of a Window. */
export function Document(props: MediaProps): JsxElement {
  return media("document", props);
}

/** Declares the single voice attachment of a Window. */
export function Voice(props: MediaProps): JsxElement {
  return media("voice", props);
}

/** Props for mounting an existing stateful keyboard widget in TSX. */
export interface WidgetProps {
  readonly instance: KeyboardWidgetInstance<any, any, any, any, any>;
}

/** Mounts a stateful keyboard widget using its stable instance id. */
export function Widget(props: WidgetProps): JsxElement {
  return element(WIDGET_ELEMENT, { ...props });
}
