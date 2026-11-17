import { Editor, Plugin, type EditorPosition } from 'obsidian';
import { applyToggle, type ToggleMode } from './transform.ts';

interface VaultConfigApi {
  getConfig(setting: 'readableLineLength'): boolean;
  setConfig(setting: 'readableLineLength', value: boolean): void;
}

interface LineSpan {
  start: EditorPosition;
  end: EditorPosition;
  content: string;
}

export default class HotkeysPlus extends Plugin {
  onload(): void {
    console.log('Loading Hotkeys++ plugin');

    this.addCommand({
      id: 'better-toggle-todo',
      name: 'Toggle to-do lists',
      editorCallback: (editor) => this.toggle(editor, 'todo'),
      hotkeys: [{ modifiers: ['Mod'], key: 'm' }],
    });

    this.addCommand({
      id: 'toggle-bullet-number',
      name: 'Toggle line to bulleted or numbered lists',
      editorCallback: (editor) => this.toggle(editor, 'list'),
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'm' }],
    });

    this.addCommand({
      id: 'toggle-block-quote',
      name: 'Toggle line to block quote',
      editorCallback: (editor) => this.toggle(editor, 'quote'),
      hotkeys: [{ modifiers: ['Mod'], key: '<' }],
    });

    this.addCommand({
      id: 'toggle-embed',
      name: 'Toggle line to embed internal links',
      editorCallback: (editor) => this.toggle(editor, 'embed'),
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: '1' }],
    });

    this.addCommand({
      id: 'duplicate-lines-down',
      name: 'Copy line(s) down',
      editorCallback: (editor) => this.duplicateLines(editor, 'down'),
    });

    this.addCommand({
      id: 'duplicate-lines-up',
      name: 'Copy line(s) up',
      editorCallback: (editor) => this.duplicateLines(editor, 'up'),
    });

    this.addCommand({
      id: 'clean-selected',
      name: 'Trims selected text and removes new line characters.',
      editorCallback: (editor) => this.cleanSelected(editor),
    });

    this.addCommand({
      id: 'insert-line-above',
      name: 'Insert line above current line',
      editorCallback: (editor) => this.insertLine(editor, 'above'),
    });

    this.addCommand({
      id: 'insert-line-below',
      name: 'Insert line below current line',
      editorCallback: (editor) => this.insertLine(editor, 'below'),
    });

    this.addCommand({
      id: 'clear-current-line',
      name: 'Clear current line',
      editorCallback: (editor) => this.clearCurrentLine(editor),
    });

    this.addCommand({
      id: 'toggle-readable-length',
      name: 'Toggle Readable Line Length',
      callback: () => this.toggleReadableLineLength(),
    });
  }

  onunload(): void {
    console.log('Unloading Hotkeys++ plugin');
  }

  private toggle(editor: Editor, mode: ToggleMode): void {
    applyToggle(editor, mode);
  }

  private clearCurrentLine(editor: Editor): void {
    editor.setLine(editor.getCursor().line, '');
  }

  private insertLine(editor: Editor, mode: 'above' | 'below'): void {
    const lineNumber = editor.getCursor().line;
    const currentLineText = editor.getLine(lineNumber);
    let newLineText = '';
    if (currentLineText.trim().startsWith('- ')) {
      newLineText = currentLineText.substring(0, currentLineText.indexOf('- ') + 2);
    }
    for (let i = 1; i < 30; i++) {
      if (currentLineText.trim().startsWith(`${i}. `)) {
        const correction = mode === 'above' ? -1 : 1;
        newLineText =
          currentLineText.substring(0, currentLineText.indexOf(`${i}. `)) +
          `${i + correction}. `;
      }
    }
    if (mode === 'above') {
      editor.replaceRange(`${newLineText}\n`, { line: lineNumber, ch: 0 });
      editor.setSelection({ line: lineNumber, ch: newLineText.length });
      return;
    }
    editor.replaceRange(`\n${newLineText}`, {
      line: lineNumber,
      ch: currentLineText.length,
    });
    editor.setSelection({ line: lineNumber + 1, ch: newLineText.length });
  }

  private duplicateLines(editor: Editor, mode: 'up' | 'down'): void {
    const selectedText = this.selectedLines(editor);
    let newString = `${selectedText.content}\n`;

    if (mode === 'down') {
      editor.replaceRange(newString, selectedText.start, selectedText.start);
      return;
    }

    if (selectedText.end.line === editor.lastLine()) {
      const cursorAnchor = editor.getCursor('anchor');
      const cursorHead = editor.getCursor('head');
      editor.setLine(editor.lastLine(), `${editor.getLine(editor.lastLine())}\n`);
      // Adding a newline can push the caret. Put it back before inserting above it.
      editor.setSelection(cursorAnchor, cursorHead);
      newString = selectedText.content;
    }

    editor.replaceRange(
      newString,
      { line: selectedText.end.line + 1, ch: 0 },
      { line: selectedText.end.line + 1, ch: 0 },
    );
  }

  private cleanSelected(editor: Editor): void {
    const selectedText = this.selectedLines(editor);
    const newString = selectedText.content
      .trim()
      .replace(/(\r\n|\n|\r)/gm, ' ')
      .replace(/ {2,}/gm, ' ');
    editor.replaceRange(newString, selectedText.start, selectedText.end);
  }

  private selectedLines(editor: Editor): LineSpan {
    const from = editor.getCursor('from');
    const to = editor.getCursor('to');
    const start = { line: from.line, ch: 0 };
    const end = { line: to.line, ch: editor.getLine(to.line).length };
    return { start, end, content: editor.getRange(start, end) };
  }

  private toggleReadableLineLength(): void {
    const vault = this.app.vault as unknown as VaultConfigApi;
    vault.setConfig('readableLineLength', !vault.getConfig('readableLineLength'));
  }
}
