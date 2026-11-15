import fs from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const code = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');

const nativeClass =
  /class\s+HotkeysPlus\s+extends\s+/.test(code) ||
  /HotkeysPlus\s*=\s*class\s+extends\s+/.test(code);
if (!nativeClass) {
  console.error('main.js is missing a native HotkeysPlus class that extends Plugin.');
  process.exit(1);
}

if (/__extends|_super\.apply|_super\.call/.test(code)) {
  console.error('main.js still contains ES5 class-extends helpers.');
  process.exit(1);
}

const commands = [];
class Plugin {
  constructor(app, manifest) {
    this.app = app;
    this.manifest = manifest;
  }

  addCommand(command) {
    commands.push(command);
  }
}

const filename = fileURLToPath(new URL('../main.js', import.meta.url));
const pluginModule = new Module(filename);
pluginModule.filename = filename;
pluginModule.paths = Module._nodeModulePaths(path.dirname(filename));
pluginModule.require = (id) => {
  if (id === 'obsidian') return { Plugin };
  return Module.prototype.require.call(pluginModule, id);
};
pluginModule._compile(code, filename);
const pluginExports = pluginModule.exports;

const PluginClass = pluginExports.default ?? pluginExports;
const plugin = new PluginClass({ vault: {}, workspace: {} }, { id: 'hotkeysplus-obsidian' });
plugin.onload();

const expectedCommands = [
  'better-toggle-todo',
  'toggle-bullet-number',
  'toggle-block-quote',
  'toggle-embed',
  'duplicate-lines-down',
  'duplicate-lines-up',
  'clean-selected',
  'insert-line-above',
  'insert-line-below',
  'clear-current-line',
  'toggle-readable-length',
];
for (const id of expectedCommands) {
  if (!commands.some((command) => command.id === id)) {
    console.error(`Command ${id} was not registered.`);
    process.exit(1);
  }
}

const todo = commands.find((command) => command.id === 'better-toggle-todo');
if (!todo?.editorCallback) {
  console.error('Toggle to-do lists did not register an editor callback.');
  process.exit(1);
}

const state = {
  lines: ['foo'],
  selections: [{ anchor: { line: 0, ch: 1 }, head: { line: 0, ch: 1 } }],
};
const editor = {
  lastLine: () => state.lines.length - 1,
  getLine: (line) => state.lines[line] ?? '',
  listSelections: () => state.selections,
  transaction(tx) {
    for (const change of tx.changes ?? []) {
      const current = state.lines[change.from.line] ?? '';
      const end = change.to?.ch ?? change.from.ch;
      state.lines[change.from.line] =
        current.slice(0, change.from.ch) + change.text + current.slice(end);
    }
  },
  setSelections(selections) {
    state.selections = selections;
  },
};

const expected = ['- foo', '- [ ] foo', '- [x] foo', '- foo'];
for (const line of expected) {
  todo.editorCallback(editor);
  if (state.lines[0] !== line) {
    console.error(`Expected ${JSON.stringify(line)} after toggle, got ${JSON.stringify(state.lines[0])}`);
    process.exit(1);
  }
}
if (state.selections[0]?.head?.ch !== 3) {
  console.error(`Expected the caret to stay in the text, got ch ${state.selections[0]?.head?.ch}`);
  process.exit(1);
}

console.log('main.js uses native class syntax and the to-do cycle runs.');
