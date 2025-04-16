export type RUBY_VERSION = "3.2" | "3.3" | "3.4";

export const RUBY_VERSIONS: Record<RUBY_VERSION, string> = {
  "3.4": "https://cdn.jsdelivr.net/npm/@ruby/3.4-wasm-wasi@2.7.1/dist/ruby+stdlib.wasm",
  "3.3": "https://cdn.jsdelivr.net/npm/@ruby/3.3-wasm-wasi@2.7.1/dist/ruby+stdlib.wasm",
  "3.2": "https://cdn.jsdelivr.net/npm/@ruby/3.2-wasm-wasi@2.7.1/dist/ruby+stdlib.wasm",
};
