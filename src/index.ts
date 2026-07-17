/**
 * Declarative, application-bound Telegram dialog interfaces for grammY.
 *
 * @module
 */

export { createDialogKit } from "./kit/dialog-kit.js";
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
  WidgetCatalog,
  WindowCatalog,
  WindowsFrom,
} from "./kit/contracts.js";
export type {
  DialogDefinitionDsl,
  DialogFactory,
  DialogWindowFactory,
  DialogWindowsContext,
  WidgetDefinitionDsl,
  WindowFactory,
} from "./kit/definition-dsl.js";
export type {
  BuiltInUiCatalog,
  InputFactory,
  IntentButtonFactory,
  TextInputFactory,
} from "./kit/built-in-widgets.js";

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

export type {
  AnimationInputValue,
  AudioInputValue,
  ContactInputValue,
  FileInputValue,
  LocationInputValue,
  MessageInputValue,
  PhotoInputValue,
  StickerInputValue,
  VideoInputValue,
  VoiceInputValue,
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
