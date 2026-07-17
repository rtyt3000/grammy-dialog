import type { Context } from "grammy";
import type { Message } from "grammy/types";
import type { Awaitable } from "./common.js";
import type { TextSource } from "./rendering.js";

export interface InputValidationSuccess<Value> { readonly ok: true; readonly value: Value; }
export interface InputValidationFailure { readonly ok: false; readonly message?: TextSource; }
export type InputValidation<Value> = InputValidationSuccess<Value> | InputValidationFailure;

export function valid<Value>(value: Value): InputValidationSuccess<Value> {
  return { ok: true, value };
}

export function invalid(message?: TextSource): InputValidationFailure {
  return { ok: false, message };
}

export interface TextInputDefinition {
  readonly kind: "text";
  readonly id: string;
  readonly trim: boolean;
  readonly onReceive: string;
  readonly validate?: (value: string) => Awaitable<InputValidation<string>>;
}

export interface InputBindingOptions {
  readonly onReceive?: string;
}

export function textInput(
  id: string,
  options: InputBindingOptions & {
    trim?: boolean;
    validate?: TextInputDefinition["validate"];
  } = {},
): TextInputDefinition {
  return {
    kind: "text",
    id,
    trim: options.trim ?? false,
    onReceive: options.onReceive ?? id,
    validate: options.validate,
  };
}

export interface PhotoInputValue {
  fileId: string;
  fileUniqueId: string;
  width: number;
  height: number;
  fileSize?: number;
  caption?: string;
  messageId: number;
}

export interface PhotoInputDefinition {
  readonly kind: "photo";
  readonly id: string;
  readonly onReceive: string;
}

export function photoInput(id: string, options: InputBindingOptions = {}): PhotoInputDefinition {
  return { kind: "photo", id, onReceive: options.onReceive ?? id };
}

export interface FileInputValue {
  fileId: string;
  fileUniqueId: string;
  fileSize?: number;
  fileName?: string;
  mimeType?: string;
  caption?: string;
  messageId: number;
}

export interface VideoInputValue extends FileInputValue { width: number; height: number; duration: number; }
export interface AnimationInputValue extends VideoInputValue {}
export interface AudioInputValue extends FileInputValue { duration: number; performer?: string; title?: string; }
export interface VoiceInputValue extends FileInputValue { duration: number; }
export interface StickerInputValue extends FileInputValue {
  width: number;
  height: number;
  emoji?: string;
  setName?: string;
  isAnimated: boolean;
  isVideo: boolean;
}
export interface ContactInputValue {
  phoneNumber: string;
  firstName: string;
  lastName?: string;
  userId?: number;
  vcard?: string;
  messageId: number;
}
export interface LocationInputValue {
  latitude: number;
  longitude: number;
  horizontalAccuracy?: number;
  livePeriod?: number;
  heading?: number;
  proximityAlertRadius?: number;
  messageId: number;
}

export type MessageInputValue = Message;
export type AttachmentInputKind =
  | "video" | "animation" | "audio" | "document" | "voice"
  | "sticker" | "contact" | "location" | "message";

export interface AttachmentInputDefinition<Kind extends AttachmentInputKind = AttachmentInputKind> {
  readonly kind: Kind;
  readonly id: string;
  readonly onReceive: string;
}

function attachmentInput<Kind extends AttachmentInputKind>(
  kind: Kind,
  id: string,
  options: InputBindingOptions,
): AttachmentInputDefinition<Kind> {
  return { kind, id, onReceive: options.onReceive ?? id };
}

export function videoInput(id: string, options: InputBindingOptions = {}): AttachmentInputDefinition<"video"> { return attachmentInput("video", id, options); }
export function animationInput(id: string, options: InputBindingOptions = {}): AttachmentInputDefinition<"animation"> { return attachmentInput("animation", id, options); }
export function audioInput(id: string, options: InputBindingOptions = {}): AttachmentInputDefinition<"audio"> { return attachmentInput("audio", id, options); }
export function documentInput(id: string, options: InputBindingOptions = {}): AttachmentInputDefinition<"document"> { return attachmentInput("document", id, options); }
export function voiceInput(id: string, options: InputBindingOptions = {}): AttachmentInputDefinition<"voice"> { return attachmentInput("voice", id, options); }
export function stickerInput(id: string, options: InputBindingOptions = {}): AttachmentInputDefinition<"sticker"> { return attachmentInput("sticker", id, options); }
export function contactInput(id: string, options: InputBindingOptions = {}): AttachmentInputDefinition<"contact"> { return attachmentInput("contact", id, options); }
export function locationInput(id: string, options: InputBindingOptions = {}): AttachmentInputDefinition<"location"> { return attachmentInput("location", id, options); }
export function messageInput(id: string, options: InputBindingOptions = {}): AttachmentInputDefinition<"message"> { return attachmentInput("message", id, options); }

export interface CustomInputDefinition<C extends Context = Context, Value = unknown> {
  readonly kind: "custom";
  readonly id: string;
  readonly onReceive: string;
  readonly match: (ctx: C) => Awaitable<boolean>;
  readonly parse: (ctx: C) => Awaitable<Value>;
  readonly validate?: (value: Value) => Awaitable<InputValidation<Value>>;
}

export type InputDefinition<C extends Context = Context> =
  | TextInputDefinition
  | PhotoInputDefinition
  | AttachmentInputDefinition
  | CustomInputDefinition<C, any>;
