// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { RubyVM } from "@ruby/wasm-wasi";

import { RUBY_VERSION } from './rubyVersions';

import { createParser, statements } from './parse';

import initializeRubyVM from './initializeRubyVM';

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

function readRubyVersion(): RUBY_VERSION {
	return vscode.workspace.getConfiguration('ruby-eval')
		.get('rubyVersion') as RUBY_VERSION ?? "3.4";
}

export async function activate(context: vscode.ExtensionContext) {
	let vm = await initializeRubyVM(readRubyVersion());
	const webAssemblyInstance = await initializeWebAssmebly();
	const parser = await createParser(webAssemblyInstance);

	let decorationType: vscode.TextEditorDecorationType | null = null;

	const disposeDecorations = () => {
		const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;

		if (editor === undefined) {
			return;
		}

		if (decorationType !== null) {
			editor.setDecorations(decorationType, []);
			decorationType.dispose();
		}
		console.info("Decorations disposed");
	};

	const outputChannel = vscode.window.createOutputChannel("Ruby Output");
	const runRuby = vscode.commands.registerCommand('ruby-eval.runRuby', async () => {
		const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;

		if (editor === undefined) {
			vscode.window.showWarningMessage("No code found");
			return;
		}

		disposeDecorations();
		const decorations: vscode.DecorationOptions[] = [];

		for (const { start, end, source } of statements(parser, editor.document.getText())) {
			const range = new vscode.Range(
				editor.document.positionAt(start),
				editor.document.positionAt(end)
			);
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
			if (output !== null) {
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

	const resetVm = vscode.commands.registerCommand('ruby-eval.resetVm', async () => {
		disposeDecorations();
		vm = await initializeRubyVM(readRubyVersion());
	});
	context.subscriptions.push(resetVm);
}

export function deactivate() { }
