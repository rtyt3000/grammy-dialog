import type { Context, InputFile } from "grammy";
import type { Awaitable } from "./common.js";
import type { RenderContext } from "./rendering.js";

export type MediaFileSource<C extends Context = Context, View = unknown, Services = unknown> =
  | string
  | InputFile
  | ((context: RenderContext<C, View, Services>) => Awaitable<string | InputFile | undefined>);

export type MediaKind = "photo" | "video" | "animation" | "audio" | "document" | "voice";

export interface MediaDefinition<
  Kind extends MediaKind = MediaKind,
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> {
  readonly kind: Kind;
  readonly source: MediaFileSource<C, View, Services>;
}

export type PhotoDefinition<C extends Context = Context, View = unknown, Services = unknown> =
  MediaDefinition<"photo", C, View, Services>;
export type VideoDefinition<C extends Context = Context, View = unknown, Services = unknown> =
  MediaDefinition<"video", C, View, Services>;
export type AnimationDefinition<C extends Context = Context, View = unknown, Services = unknown> =
  MediaDefinition<"animation", C, View, Services>;
export type AudioDefinition<C extends Context = Context, View = unknown, Services = unknown> =
  MediaDefinition<"audio", C, View, Services>;
export type DocumentDefinition<C extends Context = Context, View = unknown, Services = unknown> =
  MediaDefinition<"document", C, View, Services>;
export type VoiceDefinition<C extends Context = Context, View = unknown, Services = unknown> =
  MediaDefinition<"voice", C, View, Services>;

export type MediaSource<C extends Context = Context, View = unknown, Services = unknown> =
  | MediaDefinition<MediaKind, C, View, Services>
  | ((context: RenderContext<C, View, Services>) => Awaitable<
    MediaDefinition<MediaKind, C, View, Services> | undefined
  >);

export function photo<C extends Context = Context, View = unknown, Services = unknown>(
  source: MediaFileSource<C, View, Services>,
): PhotoDefinition<C, View, Services> {
  return { kind: "photo", source };
}

export function video<C extends Context = Context, View = unknown, Services = unknown>(
  source: MediaFileSource<C, View, Services>,
): VideoDefinition<C, View, Services> {
  return { kind: "video", source };
}

export function animation<C extends Context = Context, View = unknown, Services = unknown>(
  source: MediaFileSource<C, View, Services>,
): AnimationDefinition<C, View, Services> {
  return { kind: "animation", source };
}

export function audio<C extends Context = Context, View = unknown, Services = unknown>(
  source: MediaFileSource<C, View, Services>,
): AudioDefinition<C, View, Services> {
  return { kind: "audio", source };
}

export function document<C extends Context = Context, View = unknown, Services = unknown>(
  source: MediaFileSource<C, View, Services>,
): DocumentDefinition<C, View, Services> {
  return { kind: "document", source };
}

export function voice<C extends Context = Context, View = unknown, Services = unknown>(
  source: MediaFileSource<C, View, Services>,
): VoiceDefinition<C, View, Services> {
  return { kind: "voice", source };
}
