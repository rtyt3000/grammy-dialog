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
  locationInput,
  messageInput,
  photo,
  photoInput,
  replaceButton,
  resetButton,
  stickerInput,
  textInput,
  urlButton,
  video,
  videoInput,
  voice,
  voiceInput,
} from "../core.js";

/** Widgets and UI primitives installed in every DialogKit. */
export interface BuiltInWidgetCatalog extends Readonly<Record<string, unknown>> {
  /** Low-level callback button escape hatch. Prefer a semantic button below. */
  readonly button: typeof button;
  readonly intent: typeof intentButton;
  readonly go: typeof goButton;
  readonly replace: typeof replaceButton;
  /** Alias matching aiogram-dialog's switch-to-window terminology. */
  readonly switchTo: typeof replaceButton;
  readonly back: typeof backButton;
  readonly reset: typeof resetButton;
  readonly close: typeof closeButton;
  /** Alias for closing/cancelling the current dialog. */
  readonly cancel: typeof closeButton;
  readonly urlButton: typeof urlButton;
  readonly url: typeof urlButton;
  readonly textInput: typeof textInput;
  readonly photoInput: typeof photoInput;
  readonly videoInput: typeof videoInput;
  readonly animationInput: typeof animationInput;
  readonly audioInput: typeof audioInput;
  readonly documentInput: typeof documentInput;
  readonly voiceInput: typeof voiceInput;
  readonly stickerInput: typeof stickerInput;
  readonly contactInput: typeof contactInput;
  readonly locationInput: typeof locationInput;
  readonly messageInput: typeof messageInput;
  readonly photo: typeof photo;
  readonly video: typeof video;
  readonly animation: typeof animation;
  readonly audio: typeof audio;
  readonly document: typeof document;
  readonly voice: typeof voice;
}

/** Widgets and UI primitives available without installing an extension. */
export const builtInWidgets: BuiltInWidgetCatalog = Object.freeze({
  button,
  intent: intentButton,
  go: goButton,
  replace: replaceButton,
  switchTo: replaceButton,
  back: backButton,
  reset: resetButton,
  close: closeButton,
  cancel: closeButton,
  urlButton,
  url: urlButton,
  textInput,
  photoInput,
  videoInput,
  animationInput,
  audioInput,
  documentInput,
  voiceInput,
  stickerInput,
  contactInput,
  locationInput,
  messageInput,
  photo,
  video,
  animation,
  audio,
  document,
  voice,
});
