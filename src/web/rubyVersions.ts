export type RUBY_VERSION = "3.2" | "3.3" | "3.4";

export const RUBY_VERSIONS: Record<RUBY_VERSION, Promise<{wasm: ArrayBuffer}>> = {
  "3.4": import("wasm-3.4"),
  "3.3": import("wasm-3.3"),
  "3.2": import("wasm-3.2"),
};
