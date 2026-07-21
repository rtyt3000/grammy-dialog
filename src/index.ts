/**
 * Declarative, application-bound Telegram dialog interfaces for grammY.
 *
 * @module
 */

export { createDialogKit } from "./kit/dialog-kit.js";
export { bind, type InputBindings } from "./bindings.js";
export {
  defineInputWidget,
  defineWidget,
  type InputWidgetFactory,
  type StatefulWidgetComponent,
  type WidgetMountProps,
} from "./widgets.js";
export {
  Animation,
  Audio,
  B,
  Blockquote,
  Br,
  Button,
  Code,
  ContactInput,
  Document,
  DocumentInput,
  I,
  Input,
  Keyboard,
  Link,
  LocationInput,
  MessageInput,
  Photo,
  PhotoInput,
  Pre,
  Row,
  S,
  Spoiler,
  StickerInput,
  Text,
  TextInput,
  U,
  UrlButton,
  Video,
  VideoInput,
  Voice,
  VoiceInput,
  Widget,
  Window,
  AnimationInput,
  AudioInput,
  type AttachmentInputProps,
  type ButtonProps,
  type ChildrenProps,
  type MediaProps,
  type TextInputProps,
  type UrlButtonProps,
  type WidgetProps,
} from "./jsx/elements.js";
export type {
  JsxComponent,
  JsxElement,
  JsxNode,
  JsxViewSource,
} from "./jsx/types.js";
export {
  back,
  close,
  go,
  intent,
  replace,
  reset,
  type ButtonAction,
  type IntentAction,
  type NavigationAction,
} from "./definitions/actions.js";
export {
  defineDialogExtension,
  type StandaloneExtensionContext,
} from "./kit/extension.js";
export type {
  DialogCatalog,
  DialogExtension,
  DialogExtensionContext,
  DialogExtensionContribution,
  DialogKit,
  DialogKitMiddlewareOptions,
  DialogsFrom,
  ResourceCatalog,
  WindowCatalog,
  WindowsFrom,
} from "./kit/contracts.js";
export type {
  DialogDefinitionDsl,
  DialogFactory,
  DialogWindowFactory,
  DialogWindowsContext,
  WindowFactory,
} from "./kit/definition-dsl.js";

export type {
  DialogController,
  DialogFlavor,
  InstanceHandle,
  ShowOptions,
  StartOptions,
  UiController,
} from "./runtime/contracts.js";
export type { DialogPlugin } from "./integration/grammy-plugin.js";

export {
  MemoryStorageAdapter,
  type CallbackRecord,
  type CoordinatedStorageAdapter,
  type DialogStorageRecord,
  type IdentityCoordinator,
  type InstanceRecord,
  type StackFrame,
  type SurfaceReference,
} from "./persistence/storage.js";
export type {
  AccessInstance,
  AccessStrategy,
  ScopeResolution,
  ScopeStrategy,
} from "./definitions/policies.js";
export type {
  CloseStrategy,
  PresentationStrategy,
} from "./presentation/contracts.js";
export type { InputRoutingStrategy } from "./input-routing/contracts.js";
export type {
  CallbackCodec,
  CallbackCodecOptions,
} from "./callbacks/codec.js";

export {
  invalid,
  valid,
  type InputValidation,
  type InputValidationFailure,
  type InputValidationSuccess,
  type AnimationInputValue,
  type AudioInputValue,
  type ContactInputValue,
  type FileInputValue,
  type LocationInputValue,
  type MessageInputValue,
  type PhotoInputValue,
  type StickerInputValue,
  type VideoInputValue,
  type VoiceInputValue,
} from "./definitions/input.js";
export type {
  IntentContext,
  IntentHandler,
  IntentReference,
  ViewModelDefinition,
  ViewModelFactory,
} from "./definitions/view-model.js";
export type {
  LocaleResolver,
  Translation,
  TranslationAdapter,
} from "./definitions/i18n.js";
export type {
  DialogDefinition,
  DialogResource,
  WindowDefinition,
} from "./definitions/window.js";
export type {
  KeyboardWidgetInstance,
  KeyboardWidgetOptions,
  WidgetActionContext,
  WidgetActionHandler,
} from "./definitions/keyboard.js";
