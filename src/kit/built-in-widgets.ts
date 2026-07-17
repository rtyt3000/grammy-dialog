import {
  animation,
  animationInput,
  audio,
  audioInput,
  backButton,
  button,
  closeButton,
  contactInput,
  document,
  documentInput,
  goButton,
  intentButton,
  keyboard,
  locationInput,
  messageInput,
  photo,
  photoInput,
  replaceButton,
  resetButton,
  stickerInput,
  textInput,
  t,
  urlButton,
  video,
  videoInput,
  voice,
  voiceInput,
} from "../core.js";
import type { Context } from "grammy";
import type {
  ButtonDefinition,
  IntentButtonOptions,
  IntentReference,
  TextSource,
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
} from "../core.js";

/** Type-safe intent button used by the public categorized UI. */
export interface IntentButtonFactory {
  <
    Payload = unknown,
    C extends Context = Context,
    View = unknown,
    Services = unknown,
  >(
    text: TextSource<C, View, Services>,
    intent: IntentReference<Payload, any>,
    options?: IntentButtonOptions<Payload>,
  ): ButtonDefinition<C, View, Services>;
}

const intentReferenceButton: IntentButtonFactory = (text, reference, options) =>
  intentButton(text, reference, options);

/** Public text-input binding that requires a typed intent reference. */
export interface TextInputFactory {
  (
    id: string,
    intent: IntentReference<any, string>,
    options?: {
      readonly trim?: boolean;
      readonly validate?: TextInputDefinition["validate"];
    },
  ): TextInputDefinition;
}

/** Public attachment-input binding that requires a compatible intent reference. */
export interface InputFactory<Value, Definition> {
  (
    id: string,
    intent: IntentReference<any, Value>,
    options?: Omit<InputBindingOptions<Value>, "onReceive">,
  ): Definition;
}

const boundTextInput: TextInputFactory = (id, reference, options) =>
  textInput(id, { ...options, onReceive: reference });
const boundPhotoInput: InputFactory<PhotoInputValue, PhotoInputDefinition> =
  (id, reference) => photoInput(id, { onReceive: reference });
const boundVideoInput: InputFactory<VideoInputValue, AttachmentInputDefinition<"video">> =
  (id, reference) => videoInput(id, { onReceive: reference });
const boundAnimationInput: InputFactory<AnimationInputValue, AttachmentInputDefinition<"animation">> =
  (id, reference) => animationInput(id, { onReceive: reference });
const boundAudioInput: InputFactory<AudioInputValue, AttachmentInputDefinition<"audio">> =
  (id, reference) => audioInput(id, { onReceive: reference });
const boundDocumentInput: InputFactory<FileInputValue, AttachmentInputDefinition<"document">> =
  (id, reference) => documentInput(id, { onReceive: reference });
const boundVoiceInput: InputFactory<VoiceInputValue, AttachmentInputDefinition<"voice">> =
  (id, reference) => voiceInput(id, { onReceive: reference });
const boundStickerInput: InputFactory<StickerInputValue, AttachmentInputDefinition<"sticker">> =
  (id, reference) => stickerInput(id, { onReceive: reference });
const boundContactInput: InputFactory<ContactInputValue, AttachmentInputDefinition<"contact">> =
  (id, reference) => contactInput(id, { onReceive: reference });
const boundLocationInput: InputFactory<LocationInputValue, AttachmentInputDefinition<"location">> =
  (id, reference) => locationInput(id, { onReceive: reference });
const boundMessageInput: InputFactory<MessageInputValue, AttachmentInputDefinition<"message">> =
  (id, reference) => messageInput(id, { onReceive: reference });

/** Categorized built-in UI primitives exposed by DialogKit. */
export interface BuiltInUiCatalog {
  readonly text: {
    readonly key: typeof t;
  };
  readonly button: {
    readonly raw: typeof button;
    readonly intent: IntentButtonFactory;
    readonly go: typeof goButton;
    readonly replace: typeof replaceButton;
    readonly back: typeof backButton;
    readonly reset: typeof resetButton;
    readonly close: typeof closeButton;
    readonly url: typeof urlButton;
  };
  readonly input: {
    readonly text: TextInputFactory;
    readonly photo: InputFactory<PhotoInputValue, PhotoInputDefinition>;
    readonly video: InputFactory<VideoInputValue, AttachmentInputDefinition<"video">>;
    readonly animation: InputFactory<AnimationInputValue, AttachmentInputDefinition<"animation">>;
    readonly audio: InputFactory<AudioInputValue, AttachmentInputDefinition<"audio">>;
    readonly document: InputFactory<FileInputValue, AttachmentInputDefinition<"document">>;
    readonly voice: InputFactory<VoiceInputValue, AttachmentInputDefinition<"voice">>;
    readonly sticker: InputFactory<StickerInputValue, AttachmentInputDefinition<"sticker">>;
    readonly contact: InputFactory<ContactInputValue, AttachmentInputDefinition<"contact">>;
    readonly location: InputFactory<LocationInputValue, AttachmentInputDefinition<"location">>;
    readonly message: InputFactory<MessageInputValue, AttachmentInputDefinition<"message">>;
  };
  readonly media: {
    readonly photo: typeof photo;
    readonly video: typeof video;
    readonly animation: typeof animation;
    readonly audio: typeof audio;
    readonly document: typeof document;
    readonly voice: typeof voice;
  };
  readonly keyboard: {
    readonly compose: typeof keyboard;
  };
}

/** Built-ins grouped by their UI role instead of one flat widget namespace. */
export const builtInUi: BuiltInUiCatalog = Object.freeze({
  text: Object.freeze({ key: t }),
  button: Object.freeze({
    raw: button,
    intent: intentReferenceButton,
    go: goButton,
    replace: replaceButton,
    back: backButton,
    reset: resetButton,
    close: closeButton,
    url: urlButton,
  }),
  input: Object.freeze({
    text: boundTextInput,
    photo: boundPhotoInput,
    video: boundVideoInput,
    animation: boundAnimationInput,
    audio: boundAudioInput,
    document: boundDocumentInput,
    voice: boundVoiceInput,
    sticker: boundStickerInput,
    contact: boundContactInput,
    location: boundLocationInput,
    message: boundMessageInput,
  }),
  media: Object.freeze({ photo, video, animation, audio, document, voice }),
  keyboard: Object.freeze({ compose: keyboard }),
});
