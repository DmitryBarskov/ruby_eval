import { DefaultRubyVM } from '@ruby/wasm-wasi/dist/browser';
import { RubyVM } from "@ruby/wasm-wasi";

import { RUBY_VERSION, RUBY_VERSIONS } from "./rubyVersions";

async function initializeRubyVm(rubyVersion: RUBY_VERSION = "3.3"): Promise<RubyVM> {
  console.info("Initializing Ruby VM...");

  console.info(`Using Ruby ${rubyVersion}...`);

  console.info("Downloading WASM module...");
  const stdlib = (await RUBY_VERSIONS[rubyVersion]).wasm;
  console.info("WASM module downloaded successfully.");

  console.info("Compiling WASM module...");
  const module = await WebAssembly.compile(stdlib);
  console.info("WASM module compiled successfully.");

  console.info("Creating Ruby VM...");
  const vm = (await DefaultRubyVM(module)).vm;
  console.info("Ruby VM created successfully.");

  console.info("Preparing scripts for Ruby VM...");
  vm.eval(
    `
      require "js"

      $captured_output = []
      $original_stdout = $stdout
      $stdout = Object.new.tap do |obj|
        def obj.write(str)
          $original_stdout.write(str)
          $captured_output << str
        end
      end


      class StdinChannel
        class InputRequiredError < StandardError; end

        def ready(str)
          @ready = true
          @input = str
        end

        def gets
          if @ready
            @ready = false
            @input
          else
            raise InputRequiredError
          end
        end

        def read(length = nil)
          raise NotImplementedError
        end

        def readline
          raise NotImplementedError
        end

        def each_line(&block)
          raise NotImplementedError
        end

        def eof?
          if @ready
            @input.nil?
          else
            raise InputRequiredError
          end
        end
      end
      $stdin = StdinChannel.new
    `
  );

  console.info("Ruby VM initialized successfully.");
  return vm;
}

export default initializeRubyVm;
