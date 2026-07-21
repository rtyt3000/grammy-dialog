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
} from "./definitions/input.js";
import type {
  AnimationInputValue,
  AttachmentInputDefinition,
  AudioInputValue,
  ContactInputValue,
  FileInputValue,
  InputBindingOptions,
  LocationInputValue,
  MessageInputValue,
  PhotoInputDefinition,
  PhotoInputValue,
  StickerInputValue,
  TextInputDefinition,
  VideoInputValue,
  VoiceInputValue,
} from "./definitions/input.js";
import type { IntentReference } from "./definitions/view-model.js";

type BindingTarget<Value> = string | IntentReference<any, Value>;

function bindingId<Value>(
  target: BindingTarget<Value>,
  explicitId?: string,
): string {
  return explicitId ?? (typeof target === "string" ? target : target.name);
}

function receive<Value>(
  target: BindingTarget<Value>,
): InputBindingOptions<Value> {
  return { onReceive: target };
}

export interface TextBindingOptions {
  readonly id?: string;
  readonly trim?: boolean;
  readonly validate?: TextInputDefinition["validate"];
}

export interface TextBindingFactory {
  (
    target: BindingTarget<string>,
    options?: TextBindingOptions,
  ): TextInputDefinition;
  (
    id: string,
    target: BindingTarget<string>,
    options?: Omit<TextBindingOptions, "id">,
  ): TextInputDefinition;
}

const text: TextBindingFactory = (
  first: BindingTarget<string>,
  second?: BindingTarget<string> | TextBindingOptions,
  third?: Omit<TextBindingOptions, "id">,
) => {
  const hasExplicitId =
    typeof second === "string" ||
    (typeof second === "object" && second !== null && "name" in second);
  const target = (hasExplicitId ? second : first) as BindingTarget<string>;
  const options = (hasExplicitId ? third : second) as
    | TextBindingOptions
    | undefined;
  return textInput(
    bindingId(target, hasExplicitId ? String(first) : options?.id),
    {
      ...receive(target),
      trim: options?.trim,
      validate: options?.validate,
    },
  );
};

export interface AttachmentBindingFactory<Value, Definition> {
  (
    target: BindingTarget<Value>,
    options?: { readonly id?: string },
  ): Definition;
  (id: string, target: BindingTarget<Value>): Definition;
}

function attachment<Value, Definition>(
  factory: (id: string, options: InputBindingOptions<Value>) => Definition,
): AttachmentBindingFactory<Value, Definition> {
  return ((
    first: BindingTarget<Value>,
    second?: BindingTarget<Value> | { readonly id?: string },
  ) => {
    const hasExplicitId =
      typeof second === "string" ||
      (typeof second === "object" && second !== null && "name" in second);
    const target = (hasExplicitId ? second : first) as BindingTarget<Value>;
    const options = (hasExplicitId ? undefined : second) as
      | { readonly id?: string }
      | undefined;
    return factory(
      bindingId(target, hasExplicitId ? String(first) : options?.id),
      receive(target),
    );
  }) as AttachmentBindingFactory<Value, Definition>;
}

/** Typed input bindings that can be used without a DialogKit instance. */
export interface InputBindings {
  readonly text: TextBindingFactory;
  readonly photo: AttachmentBindingFactory<PhotoInputValue, PhotoInputDefinition>;
  readonly video: AttachmentBindingFactory<
    VideoInputValue,
    AttachmentInputDefinition<"video">
  >;
  readonly animation: AttachmentBindingFactory<
    AnimationInputValue,
    AttachmentInputDefinition<"animation">
  >;
  readonly audio: AttachmentBindingFactory<
    AudioInputValue,
    AttachmentInputDefinition<"audio">
  >;
  readonly document: AttachmentBindingFactory<
    FileInputValue,
    AttachmentInputDefinition<"document">
  >;
  readonly voice: AttachmentBindingFactory<
    VoiceInputValue,
    AttachmentInputDefinition<"voice">
  >;
  readonly sticker: AttachmentBindingFactory<
    StickerInputValue,
    AttachmentInputDefinition<"sticker">
  >;
  readonly contact: AttachmentBindingFactory<
    ContactInputValue,
    AttachmentInputDefinition<"contact">
  >;
  readonly location: AttachmentBindingFactory<
    LocationInputValue,
    AttachmentInputDefinition<"location">
  >;
  readonly message: AttachmentBindingFactory<
    MessageInputValue,
    AttachmentInputDefinition<"message">
  >;
}

/** Typed input bindings that can be used without a DialogKit instance. */
export const bind: InputBindings = Object.freeze({
  text,
  photo: attachment<PhotoInputValue, PhotoInputDefinition>(photoInput),
  video: attachment<VideoInputValue, AttachmentInputDefinition<"video">>(
    videoInput,
  ),
  animation: attachment<
    AnimationInputValue,
    AttachmentInputDefinition<"animation">
  >(animationInput),
  audio: attachment<AudioInputValue, AttachmentInputDefinition<"audio">>(
    audioInput,
  ),
  document: attachment<FileInputValue, AttachmentInputDefinition<"document">>(
    documentInput,
  ),
  voice: attachment<VoiceInputValue, AttachmentInputDefinition<"voice">>(
    voiceInput,
  ),
  sticker: attachment<StickerInputValue, AttachmentInputDefinition<"sticker">>(
    stickerInput,
  ),
  contact: attachment<ContactInputValue, AttachmentInputDefinition<"contact">>(
    contactInput,
  ),
  location: attachment<
    LocationInputValue,
    AttachmentInputDefinition<"location">
  >(locationInput),
  message: attachment<MessageInputValue, AttachmentInputDefinition<"message">>(
    messageInput,
  ),
});
