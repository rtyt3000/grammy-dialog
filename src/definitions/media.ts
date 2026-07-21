import type { Context, InputFile } from "grammy";
import type { Awaitable } from "./common.js";
import type { RenderContext } from "./rendering.js";

/** A Telegram file id, URL, InputFile, or render-time media resolver. */
export type MediaFileSource<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> =
  | string
  | InputFile
  | ((
      context: RenderContext<C, View, Services>,
    ) => Awaitable<string | InputFile | undefined>);

/** Media kinds supported by single-message window surfaces. */
export type MediaKind =
  | "photo"
  | "video"
  | "animation"
  | "audio"
  | "document"
  | "voice";

/** Declarative media attachment rendered by a window. */
export interface MediaDefinition<
  Kind extends MediaKind = MediaKind,
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> {
  readonly kind: Kind;
  readonly source: MediaFileSource<C, View, Services>;
}

/** Photo media definition. */
export type PhotoDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> = MediaDefinition<"photo", C, View, Services>;
/** Video media definition. */
export type VideoDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> = MediaDefinition<"video", C, View, Services>;
/** Animation media definition. */
export type AnimationDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> = MediaDefinition<"animation", C, View, Services>;
/** Audio media definition. */
export type AudioDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> = MediaDefinition<"audio", C, View, Services>;
/** Document media definition. */
export type DocumentDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> = MediaDefinition<"document", C, View, Services>;
/** Voice media definition. */
export type VoiceDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> = MediaDefinition<"voice", C, View, Services>;

/** Static media or a function that may omit media for the current render. */
export type MediaSource<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> =
  | MediaDefinition<MediaKind, C, View, Services>
  | ((
      context: RenderContext<C, View, Services>,
    ) => Awaitable<MediaDefinition<MediaKind, C, View, Services> | undefined>);

/** Creates a photo media definition. */
export function photo<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
>(
  source: MediaFileSource<C, View, Services>,
): PhotoDefinition<C, View, Services> {
  return { kind: "photo", source };
}

/** Creates a video media definition. */
export function video<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
>(
  source: MediaFileSource<C, View, Services>,
): VideoDefinition<C, View, Services> {
  return { kind: "video", source };
}

/** Creates an animation media definition. */
export function animation<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
>(
  source: MediaFileSource<C, View, Services>,
): AnimationDefinition<C, View, Services> {
  return { kind: "animation", source };
}

/** Creates an audio media definition. */
export function audio<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
>(
  source: MediaFileSource<C, View, Services>,
): AudioDefinition<C, View, Services> {
  return { kind: "audio", source };
}

/** Creates a document media definition. */
export function document<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
>(
  source: MediaFileSource<C, View, Services>,
): DocumentDefinition<C, View, Services> {
  return { kind: "document", source };
}

/** Creates a voice media definition. */
export function voice<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
>(
  source: MediaFileSource<C, View, Services>,
): VoiceDefinition<C, View, Services> {
  return { kind: "voice", source };
}
