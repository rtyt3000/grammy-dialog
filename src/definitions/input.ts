import type { Context } from "grammy";
import type { Message } from "grammy/types";
import type { Awaitable } from "./common.js";
import type { TextSource } from "./rendering.js";
import type { IntentReference } from "./view-model.js";

/** Successful input validation with the normalized value passed to the intent. */
export interface InputValidationSuccess<Value> {
  readonly ok: true;
  readonly value: Value;
}
/** Failed input validation with an optional user-facing error message. */
export interface InputValidationFailure {
  readonly ok: false;
  readonly message?: TextSource;
}
/** Result returned by an input validator. */
export type InputValidation<Value> =
  | InputValidationSuccess<Value>
  | InputValidationFailure;

/** Marks an input value as valid and optionally replaces it with a normalized value. */
export function valid<Value>(value: Value): InputValidationSuccess<Value> {
  return { ok: true, value };
}

/** Marks an input value as invalid. */
export function invalid(message?: TextSource): InputValidationFailure {
  return { ok: false, message };
}

/** Definition of a text-message input binding. */
export interface TextInputDefinition {
  readonly kind: "text";
  readonly id: string;
  readonly trim: boolean;
  readonly onReceive: string;
  readonly validate?: (value: string) => Awaitable<InputValidation<string>>;
}

/** Shared options for binding an input to a ViewModel intent. */
export interface InputBindingOptions<Value = unknown> {
  /** Intent name; defaults to the input widget id. */
  readonly onReceive?: string | IntentReference<any, Value>;
}

function intentName(reference: string | IntentReference<any, any>): string {
  return typeof reference === "string" ? reference : reference.name;
}

/** Creates a text input; trimming is disabled and `onReceive` defaults to `id`. */
export function textInput(
  id: string,
  options: InputBindingOptions<string> & {
    trim?: boolean;
    validate?: TextInputDefinition["validate"];
  } = {},
): TextInputDefinition {
  return {
    kind: "text",
    id,
    trim: options.trim ?? false,
    onReceive: intentName(options.onReceive ?? id),
    validate: options.validate,
  };
}

/** Normalized value produced by a photo input. */
export interface PhotoInputValue {
  fileId: string;
  fileUniqueId: string;
  width: number;
  height: number;
  fileSize?: number;
  caption?: string;
  messageId: number;
}

/** Definition of a Telegram photo input. */
export interface PhotoInputDefinition {
  readonly kind: "photo";
  readonly id: string;
  readonly onReceive: string;
}

/** Creates a photo input whose receive intent defaults to its id. */
export function photoInput(
  id: string,
  options: InputBindingOptions<PhotoInputValue> = {},
): PhotoInputDefinition {
  return { kind: "photo", id, onReceive: intentName(options.onReceive ?? id) };
}

/** Common Telegram file metadata normalized by attachment inputs. */
export interface FileInputValue {
  fileId: string;
  fileUniqueId: string;
  fileSize?: number;
  fileName?: string;
  mimeType?: string;
  caption?: string;
  messageId: number;
}

/** Normalized Telegram video metadata. */
export interface VideoInputValue extends FileInputValue {
  width: number;
  height: number;
  duration: number;
}
/** Normalized Telegram animation metadata. */
export interface AnimationInputValue extends VideoInputValue {}
/** Normalized Telegram audio metadata. */
export interface AudioInputValue extends FileInputValue {
  duration: number;
  performer?: string;
  title?: string;
}
/** Normalized Telegram voice metadata. */
export interface VoiceInputValue extends FileInputValue {
  duration: number;
}
/** Normalized Telegram sticker metadata. */
export interface StickerInputValue extends FileInputValue {
  width: number;
  height: number;
  emoji?: string;
  setName?: string;
  isAnimated: boolean;
  isVideo: boolean;
}
/** Normalized Telegram contact. */
export interface ContactInputValue {
  phoneNumber: string;
  firstName: string;
  lastName?: string;
  userId?: number;
  vcard?: string;
  messageId: number;
}
/** Normalized Telegram location. */
export interface LocationInputValue {
  latitude: number;
  longitude: number;
  horizontalAccuracy?: number;
  livePeriod?: number;
  heading?: number;
  proximityAlertRadius?: number;
  messageId: number;
}

/** An unmodified grammY message accepted by `messageInput`. */
export type MessageInputValue = Message;
/** Built-in non-text input kinds. */
export type AttachmentInputKind =
  | "video"
  | "animation"
  | "audio"
  | "document"
  | "voice"
  | "sticker"
  | "contact"
  | "location"
  | "message";

/** Definition of a built-in attachment or structured-message input. */
export interface AttachmentInputDefinition<
  Kind extends AttachmentInputKind = AttachmentInputKind,
> {
  readonly kind: Kind;
  readonly id: string;
  readonly onReceive: string;
}

function attachmentInput<Kind extends AttachmentInputKind, Value>(
  kind: Kind,
  id: string,
  options: InputBindingOptions<Value>,
): AttachmentInputDefinition<Kind> {
  return { kind, id, onReceive: intentName(options.onReceive ?? id) };
}

/** Creates a video input whose receive intent defaults to its id. */
export function videoInput(
  id: string,
  options: InputBindingOptions<VideoInputValue> = {},
): AttachmentInputDefinition<"video"> {
  return attachmentInput("video", id, options);
}
/** Creates an animation input whose receive intent defaults to its id. */
export function animationInput(
  id: string,
  options: InputBindingOptions<AnimationInputValue> = {},
): AttachmentInputDefinition<"animation"> {
  return attachmentInput("animation", id, options);
}
/** Creates an audio input whose receive intent defaults to its id. */
export function audioInput(
  id: string,
  options: InputBindingOptions<AudioInputValue> = {},
): AttachmentInputDefinition<"audio"> {
  return attachmentInput("audio", id, options);
}
/** Creates a document input whose receive intent defaults to its id. */
export function documentInput(
  id: string,
  options: InputBindingOptions<FileInputValue> = {},
): AttachmentInputDefinition<"document"> {
  return attachmentInput("document", id, options);
}
/** Creates a voice input whose receive intent defaults to its id. */
export function voiceInput(
  id: string,
  options: InputBindingOptions<VoiceInputValue> = {},
): AttachmentInputDefinition<"voice"> {
  return attachmentInput("voice", id, options);
}
/** Creates a sticker input whose receive intent defaults to its id. */
export function stickerInput(
  id: string,
  options: InputBindingOptions<StickerInputValue> = {},
): AttachmentInputDefinition<"sticker"> {
  return attachmentInput("sticker", id, options);
}
/** Creates a contact input whose receive intent defaults to its id. */
export function contactInput(
  id: string,
  options: InputBindingOptions<ContactInputValue> = {},
): AttachmentInputDefinition<"contact"> {
  return attachmentInput("contact", id, options);
}
/** Creates a location input whose receive intent defaults to its id. */
export function locationInput(
  id: string,
  options: InputBindingOptions<LocationInputValue> = {},
): AttachmentInputDefinition<"location"> {
  return attachmentInput("location", id, options);
}
/** Creates a raw message input whose receive intent defaults to its id. */
export function messageInput(
  id: string,
  options: InputBindingOptions<MessageInputValue> = {},
): AttachmentInputDefinition<"message"> {
  return attachmentInput("message", id, options);
}

/** Definition produced by a user-defined input widget. */
export interface CustomInputDefinition<
  C extends Context = Context,
  Value = unknown,
> {
  readonly kind: "custom";
  readonly id: string;
  readonly onReceive: string;
  readonly match: (ctx: C) => Awaitable<boolean>;
  readonly parse: (ctx: C) => Awaitable<Value>;
  readonly validate?: (value: Value) => Awaitable<InputValidation<Value>>;
}

/** Any input definition understood by the runtime matcher. */
export type InputDefinition<C extends Context = Context> =
  | TextInputDefinition
  | PhotoInputDefinition
  | AttachmentInputDefinition
  | CustomInputDefinition<C, any>;
