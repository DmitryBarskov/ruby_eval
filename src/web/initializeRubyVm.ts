import { DefaultRubyVM } from '@ruby/wasm-wasi/dist/browser';
import { RubyVM } from "@ruby/wasm-wasi";

import { RUBY_VERSION, RUBY_VERSIONS } from "./rubyVersions";

async function initializeRubyVm(rubyVersion: RUBY_VERSION = "3.3"): Promise<RubyVM> {
  console.info("Initializing Ruby VM...");

  console.info(`Using Ruby ${rubyVersion}...`);

  console.info("Downloading WASM module...");
  const stdlib = await fetch(RUBY_VERSIONS[rubyVersion]);
  console.info("WASM module downloaded successfully.");

  console.info("Compiling WASM module...");
  const module = await WebAssembly.compileStreaming(stdlib);
  console.info("WASM module compiled successfully.");

  console.info("Creating Ruby VM...");
  const vm = (await DefaultRubyVM(module)).vm;
  console.info("Ruby VM created successfully.");

  console.info("Preparing scripts for Ruby VM...");
  vm.eval(
    `
      require "js"

      class VscOutput
        def initialize(original_stdout)
          @original_stdout = original_stdout
          @captured_output = []
        end

        def write(str)
          $stdout.puts "Writing a #{str.class}"
          @original_stdout.write(str)
          @captured_output.push(str)
        end

        def any? = @captured_output.any?
        def join = @captured_output.join
        def reset = @captured_output = []

        def respond_to_missing?(name, include_private = false)
          @original_stdout.respond_to?(name, include_private) || super
        end

        def method_missing(name, *args)
          if @original_stdout.respond_to?(name)
            @original_stdout.send(name, *args)
          else
            super
          end
        end
      end
      $stdout = VscOutput.new($stdout)

      class VscIO
        class InputRequiredError < StandardError; end

        def initialize
          @chars = []
          @current_position = 0
        end

        def write(str)
          if str.nil?
            @chars.push(nil)
          else
            @chars.concat(str.chars)
          end
        end

        def gets
          if @current_position < @chars.length && @chars[@current_position].nil?
            @current_position += 1
            return nil
          end

          end_of_line = (@current_position...@chars.length).find do |i|
            @chars[i] == "\n" || @chars[i].nil?
          end

          require_input if end_of_line.nil?

          next_line = @chars[@current_position..end_of_line].join
          @current_position = end_of_line + 1
          ensure_newline(next_line)
        end

        def read(length = nil)
          end_of_file = @current_position
          while end_of_file < @chars.length
            break if length && end_of_file - @current_position >= length
            break if @chars[end_of_file].nil?

            end_of_file += 1
          end
          chars_read = end_of_file - @current_position

          if length && chars_read >= length
            next_chunk = @chars[@current_position...end_of_file].join
            @current_position = end_of_file
            return next_chunk
          elsif end_of_file < @chars.length && @chars[end_of_file].nil?
            next_chunk = @chars[@current_position...end_of_file].join
            @current_position = end_of_file + 1
            return next_chunk
          else
            require_input
          end
        end

        def readline
          line = gets
          raise EOFError.new("end of file reached") if line.nil?
          line
        end

        def readlines
          lines = read.scan(/.*\n?/)
          if lines.pop != ""
            $stdout.write(
              "Some input got truncated. Please report this behavior #{self.inspect}"
            )
          end
          lines
        end

        def each_line(&block)
          readlines.each(&block)
        end

        def eof? = false

        private

        def require_input
          raise InputRequiredError.new("Input required. Call #write with a string to provide input.")
        end

        def ensure_newline(str)
          str += "\n" if str[-1] != "\n"
          str
        end
      end
      $stdin = VscIO.new
    `
  );

  console.info("Ruby VM initialized successfully.");
  return vm;
}

export default initializeRubyVm;
