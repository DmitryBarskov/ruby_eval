// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { RubyVM } from "@ruby/wasm-wasi";
import { DefaultRubyVM } from '@ruby/wasm-wasi/dist/browser';

export class RubyCodeLensProvider implements vscode.CodeLensProvider {
	constructor(private vm: RubyVM) { }

	async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
		const lenses: vscode.CodeLens[] = [];
		const editorContent = document.getText();
		const statements = (await parse(editorContent)).value.statements;
		statements.childNodes().forEach((statement) => {
			if (statement == null) { return; }
			const { startOffset, length } = statement.location;
			const range = new vscode.Range(
				document.positionAt(startOffset),
				document.positionAt(startOffset + length)
			);
			const statementSource = editorContent.substring(startOffset, startOffset + length);
			const { result, output } = evalInVm(this.vm, statementSource);
		});
		return lenses;
	}
}

async function initializeRubyVM(): Promise<RubyVM> {
	const vm = await WebAssembly.compileStreaming(
		fetch("https://cdn.jsdelivr.net/npm/@ruby/3.4-wasm-wasi@2.7.1/dist/ruby+stdlib.wasm")
	).then(async (module) => (await DefaultRubyVM(module)).vm)

	vm.eval('require "js"');
	vm.eval(
		`
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
	return vm;
}

function evalInVm(vm: RubyVM, source: string): {result: any, output: string | null} {
	vm.eval('$captured_output = []');
	const result = vm.eval(source).toJS();
	const outputPresent = vm.eval('$captured_output.any?').toJS();
	let output: string | null = null;
	if (outputPresent) {
		output = vm.eval('$captured_output.join').toJS();
	}
	return { result, output };
}

async function* statements(source: string) {
	for (const statement of (await parse(source)).value.statements.childNodes()) {
		if (statement == null) { continue; }
		const { startOffset, length } = statement.location;
		const statementSource = source.substring(startOffset, startOffset + length);
		const statementInfo = {
			start: startOffset, end: startOffset + length,
			length,
			source: statementSource,
		};
		yield statementInfo;
	}
}

async function parse(source: string) {
	const wasm = await WebAssembly.compileStreaming(
		fetch("https://unpkg.com/@ruby/prism@latest/src/prism.wasm")
	);

	const { WASI } = await import('@bjorn3/browser_wasi_shim');
	const wasi = new WASI([], [], []);
	const instance = await WebAssembly.instantiate(wasm, { wasi_snapshot_preview1: wasi.wasiImport });
	wasi.initialize({
		exports: {
			...instance.exports,
			memory: instance.exports["memory"] as WebAssembly.Memory,
		},
	});

	const { parsePrism } = await import('@ruby/prism/src/parsePrism.js');
	return parsePrism(instance.exports, source);
}

export async function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	const vm = await initializeRubyVM();
	const outputChannel = vscode.window.createOutputChannel("Ruby Output");

	let decorationType: vscode.TextEditorDecorationType | null = null;

	const disposable = vscode.commands.registerCommand('ruby-eval.runRuby', async () => {
		const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;

		if (!editor) {
			vscode.window.showWarningMessage("No code found");
			return;
		}

		if (decorationType != null) {
			editor.setDecorations(decorationType, []);
			decorationType.dispose();
		}
		const decorations: vscode.DecorationOptions[] = [];

		for await (const { start, end, source } of statements(editor.document.getText())) {
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

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
