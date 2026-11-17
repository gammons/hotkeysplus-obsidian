import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../main.ts', import.meta.url), 'utf8');

test('the plugin calls the Editor API and not CodeMirror 5 document internals', () => {
  assert.equal(source.includes('getDoc('), false);
  assert.equal(source.includes('CodeMirror'), false);
  assert.equal(source.includes('editorCallback'), true);
  assert.equal(source.includes('applyToggle'), true);
});

test('TypeScript targets ES2021, which emits native class extends', () => {
  const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, '.');
  assert.ok(parsed.options.target !== undefined);
  assert.ok(parsed.options.target >= ts.ScriptTarget.ES2021);
});

test('an ES5 subclass calls Plugin without new, which Obsidian 1.15 rejects', () => {
  const sample = `import { Plugin } from 'obsidian';
export default class HotkeysPlus extends Plugin {}
`;
  const es5 = ts.transpileModule(sample, {
    compilerOptions: {
      target: ts.ScriptTarget.ES5,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  assert.match(es5, /\.apply\(this|\.call\(this/);

  const modern = ts.transpileModule(sample, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2021,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  assert.match(modern, /class HotkeysPlus extends/);
  assert.doesNotMatch(modern, /__extends|\.apply\(this|\.call\(this/);
});
