/** Converts callback payloads between Telegram data and storage tokens. */
export interface CallbackCodec {
  readonly prefix: string;
  encode(debugHint?: string): string;
  decode(data: string): string | undefined;
}

/** Options for the built-in opaque or human-readable callback codec. */
export interface CallbackCodecOptions {
  /** Opaque random tokens by default, or readable hints for debugging. */
  mode?: "opaque" | "debug";
  /** Callback data prefix; defaults to `gd:`. */
  prefix?: string;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/** Creates the built-in callback codec and enforces Telegram's 64-byte limit. */
export function createCallbackCodec(
  options: CallbackCodecOptions = {},
): CallbackCodec {
  const prefix = options.prefix ?? "gd:";
  const mode = options.mode ?? "opaque";

  return {
    prefix,

    encode(debugHint) {
      const token =
        mode === "debug"
          ? `${debugHint ?? "callback"}.${crypto.randomUUID().slice(0, 8)}`
          : crypto.randomUUID().replaceAll("-", "");
      const result = `${prefix}${token}`;

      if (byteLength(result) > 64) {
        throw new Error(
          `Callback data exceeds Telegram's 64-byte limit: ${byteLength(result)} bytes`,
        );
      }

      return result;
    },

    decode(data) {
      return data.startsWith(prefix) ? data.slice(prefix.length) : undefined;
    },
  };
}
