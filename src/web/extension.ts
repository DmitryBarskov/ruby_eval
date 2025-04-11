// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { RubyVM } from "@ruby/wasm-wasi";
import { DefaultRubyVM } from '@ruby/wasm-wasi/dist/browser';

async function initializeRubyVM(): Promise<RubyVM> {
	console.info("Initializing Ruby VM...");

	console.info("Downloading WASM module...");
	const stdlib = await fetch("https://cdn.jsdelivr.net/npm/@ruby/3.4-wasm-wasi@2.7.1/dist/ruby+stdlib.wasm");
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

function evalInVm(vm: RubyVM, source: string): {result: any, output: string | null} {
	console.info(`Evaluating code (${source.length} chars)`);
	console.debug(`Source: ${source}`);

	try {
		vm.eval('$captured_output = []');
		const result = vm.eval(source).toJS();
		const outputPresent = vm.eval('$captured_output.any?').toJS();
		let output: string | null = null;
		if (outputPresent) {
			output = vm.eval('$captured_output.join').toJS();
		}

		console.info('Code evaluated successfully');
		console.debug(`Value = ${result}, Output = ${output}`);
		return { result, output };
	} catch (error) {
		const outputPresent = vm.eval('$captured_output.any?').toJS();
		let output: string | null = null;
		if (outputPresent) {
			output = vm.eval('$captured_output.join').toJS();
		}
		console.error(`Error evaluating code: ${error}, Output = ${output}`);
		return { result: error, output };
	}
}

type StatementInfo = {
	start: number;
	end: number;
	length: number;
	source: string;
};

function* statements(parse: (s: string) => any, source: string): Generator<StatementInfo, void, unknown> {
	console.info("Finding statements...");
	const statements = parse(source).value.statements.childNodes();
	for (const statement of statements) {
		if (statement == null) { continue; }

		const { startOffset, length } = statement.location;
		const statementSource: string = source.substring(startOffset, startOffset + length);
		const statementInfo: StatementInfo = {
			start: startOffset, end: startOffset + length,
			length,
			source: statementSource,
		};
		yield statementInfo;
	}
	console.info("All statements retreived.");
}

async function initializeWebAssmebly() {
	console.info("Initializing WebAssembly...");

	console.info("Downloading Prism...");
	const prism = await fetch("https://unpkg.com/@ruby/prism@latest/src/prism.wasm");
	console.info("Prism downloaded successfully.");

	console.info("Compiling Prism...");
	const wasm = await WebAssembly.compileStreaming(prism);
	console.info("Prism compiled successfully.");

	console.info("Creating WASI instance...");
	const { WASI } = await import('@bjorn3/browser_wasi_shim');
	const wasi = new WASI([], [], []);
	console.info("WASI instance created successfully.");

	console.info("Creating WebAssembly instance...");
	const instance = await WebAssembly.instantiate(wasm, { wasi_snapshot_preview1: wasi.wasiImport });
	wasi.initialize({
		exports: {
			...instance.exports,
			memory: instance.exports["memory"] as WebAssembly.Memory,
		},
	});
	console.info("WebAssembly instance created successfully.");

	console.info("WebAssembly initialized successfully.");
	return instance;
}

async function createParser(webAssemblyInstance: WebAssembly.Instance) {
	console.info("Creating parser...");
	console.info("Loading Prism...");
	const { parsePrism } = await import('@ruby/prism/src/parsePrism.js');
	console.info("Prism loaded successfully.");

	const parseFunc = function _parse(source: string) {
		console.info(`Parsing source (${source.length} chars)`);
		console.debug(`Source: ${source}`);
		const parseResult = parsePrism(webAssemblyInstance.exports, source);
		console.info("Parsed.");
		return parseResult;
	};
	console.info("Parser created successfully.");
	return parseFunc;
}

export async function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	const [vm, webAssemblyInstance] = await Promise.all([
		initializeRubyVM(),
		initializeWebAssmebly(),
	]);
	const parser = await createParser(webAssemblyInstance);

	const outputChannel = vscode.window.createOutputChannel("Ruby Output");

	let decorationType: vscode.TextEditorDecorationType | null = null;

	let disposeDecorations = () => {
		const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;

		if (editor == undefined) {
			return;
		}

		if (decorationType != null) {
			editor.setDecorations(decorationType, []);
			decorationType.dispose();
		}
		console.info("Decorations disposed");
	};

	const runRuby = vscode.commands.registerCommand('ruby-eval.runRuby', async () => {
		const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;

		if (editor == undefined) {
			vscode.window.showWarningMessage("No code found");
			return;
		}

		disposeDecorations();
		const decorations: vscode.DecorationOptions[] = [];

		for (const { start, end, source } of statements(parser, editor.document.getText())) {
			const range = new vscode.Range(
				editor.document.positionAt(start),
				editor.document.positionAt(end)
			)
			const { result, output } = evalInVm(vm, `(${source}).inspect`);
			const contentText = ` => ${result}`;
			decorations.push({
				range, renderOptions: {
					after: {
						contentText,
						color: 'gray',
					},
				}
			});
			if (output != null) {
				outputChannel.append(output);
				outputChannel.show();
			}
		}

		decorationType = vscode.window.createTextEditorDecorationType({
			isWholeLine: true,
		});
		editor.setDecorations(decorationType, decorations);
	});

	context.subscriptions.push(runRuby);

	const clearDecorations = vscode.commands.registerCommand('ruby-eval.clearDecorations', disposeDecorations);
	context.subscriptions.push(clearDecorations);
}

// This method is called when your extension is deactivated
export function deactivate() { }
