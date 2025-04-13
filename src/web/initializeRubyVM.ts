import { DefaultRubyVM } from '@ruby/wasm-wasi/dist/browser';
import { RubyVM } from "@ruby/wasm-wasi";

import { RUBY_VERSION, RUBY_VERSIONS } from "./rubyVersions";

async function initializeRubyVM(rubyVersion: RUBY_VERSION = "3.4"): Promise<RubyVM> {
	console.info("Initializing Ruby VM...");

	console.info(`Using Ruby ${rubyVersion}...`);

	console.info("Downloading WASM module...");
	const stdlib = await fetch(RUBY_VERSIONS[rubyVersion].wasm);
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

			$captured_output = []
			$original_stdout = $stdout
			$stdout = Object.new.tap do |obj|
				def obj.write(str)
					$original_stdout.write(str)
					$captured_output << str
				end
			end
		`
	);

	console.info("Ruby VM initialized successfully.");
	return vm;
}

export default initializeRubyVM;
