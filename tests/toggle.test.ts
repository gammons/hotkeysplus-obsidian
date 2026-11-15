import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyToggle,
  buildEditorUpdate,
  toggleLines,
  type EditorChange,
  type EditorSurface,
  type TextSelection,
} from '../transform.ts';

function caret(line: number, ch: number): TextSelection {
  return { anchor: { line, ch }, head: { line, ch } };
}

function selection(
  anchorLine: number,
  anchorCh: number,
  headLine: number,
  headCh: number,
): TextSelection {
  return {
    anchor: { line: anchorLine, ch: anchorCh },
    head: { line: headLine, ch: headCh },
  };
}

test('a plain line cycles bullet, open checkbox, checked checkbox, then bullet', () => {
  let lines = ['foo'];
  let selections = [caret(0, 1)];

  ({ lines, selections } = toggleLines(lines, selections, 'todo'));
  assert.deepEqual(lines, ['- foo']);
  assert.deepEqual(selections, [caret(0, 3)]);

  ({ lines, selections } = toggleLines(lines, selections, 'todo'));
  assert.deepEqual(lines, ['- [ ] foo']);
  assert.deepEqual(selections, [caret(0, 7)]);

  ({ lines, selections } = toggleLines(lines, selections, 'todo'));
  assert.deepEqual(lines, ['- [x] foo']);
  assert.deepEqual(selections, [caret(0, 7)]);

  ({ lines, selections } = toggleLines(lines, selections, 'todo'));
  assert.deepEqual(lines, ['- foo']);
  assert.deepEqual(selections, [caret(0, 3)]);
});

test('the caret on a plain or empty line lands after the inserted marker', () => {
  assert.deepEqual(toggleLines(['foo'], [caret(0, 0)], 'todo'), {
    lines: ['- foo'],
    selections: [caret(0, 2)],
  });
  assert.deepEqual(toggleLines([''], [caret(0, 0)], 'todo'), {
    lines: ['- '],
    selections: [caret(0, 2)],
  });
});

test('indentation is kept and the caret stays on the same character', () => {
  assert.deepEqual(toggleLines(['    foo'], [caret(0, 6)], 'todo'), {
    lines: ['    - foo'],
    selections: [caret(0, 8)],
  });
  assert.deepEqual(toggleLines(['\tfoo'], [caret(0, 0)], 'todo'), {
    lines: ['\t- foo'],
    selections: [caret(0, 3)],
  });
  assert.deepEqual(toggleLines(['  - [ ] buy milk'], [caret(0, 12)], 'todo'), {
    lines: ['  - [x] buy milk'],
    selections: [caret(0, 12)],
  });
});

test('a caret sitting on the marker moves to just after the new marker', () => {
  assert.deepEqual(toggleLines(['- foo'], [caret(0, 1)], 'todo'), {
    lines: ['- [ ] foo'],
    selections: [caret(0, 6)],
  });
});

test('dashes inside the sentence are not treated as list markers', () => {
  assert.deepEqual(toggleLines(['buy milk - 2 liters'], [caret(0, 4)], 'todo'), {
    lines: ['- buy milk - 2 liters'],
    selections: [caret(0, 6)],
  });
  assert.deepEqual(toggleLines(['- hello - world'], [caret(0, 9)], 'todo'), {
    lines: ['- [ ] hello - world'],
    selections: [caret(0, 13)],
  });
});

test('star, plus, and numbered lines enter the to-do cycle as list items or checkboxes', () => {
  assert.deepEqual(toggleLines(['* foo'], [caret(0, 3)], 'todo'), {
    lines: ['- [ ] foo'],
    selections: [caret(0, 7)],
  });
  assert.deepEqual(toggleLines(['+ foo'], [caret(0, 3)], 'todo'), {
    lines: ['- [ ] foo'],
    selections: [caret(0, 7)],
  });
  assert.deepEqual(toggleLines(['12. foo'], [caret(0, 5)], 'todo'), {
    lines: ['- foo'],
    selections: [caret(0, 3)],
  });
  assert.deepEqual(toggleLines(['* [x] foo'], [caret(0, 8)], 'todo'), {
    lines: ['- foo'],
    selections: [caret(0, 4)],
  });
  assert.deepEqual(toggleLines(['- [X] foo'], [caret(0, 8)], 'todo'), {
    lines: ['- foo'],
    selections: [caret(0, 4)],
  });
});

test('a multi-line selection cycles every touched line and keeps each endpoint in the text', () => {
  const result = toggleLines(
    ['alpha', '  beta', 'gamma'],
    [selection(0, 2, 2, 1)],
    'todo',
  );
  assert.deepEqual(result.lines, ['- alpha', '  - beta', '- gamma']);
  assert.deepEqual(result.selections, [selection(0, 4, 2, 3)]);
});

test('a selection that only ends at the next line does not toggle that line', () => {
  const result = toggleLines(
    ['alpha', 'beta'],
    [selection(0, 1, 1, 0)],
    'todo',
  );
  assert.deepEqual(result.lines, ['- alpha', 'beta']);
  assert.deepEqual(result.selections, [selection(0, 3, 1, 0)]);
});

test('a collapsed caret at column 0 still toggles its own line', () => {
  assert.deepEqual(toggleLines(['alpha', 'beta'], [caret(1, 0)], 'todo'), {
    lines: ['alpha', '- beta'],
    selections: [caret(1, 2)],
  });
});

test('multiple carets cycle their own lines and a reversed selection keeps its direction', () => {
  const carets = toggleLines(
    ['one', 'two', 'three'],
    [caret(0, 2), caret(2, 1)],
    'todo',
  );
  assert.deepEqual(carets.lines, ['- one', 'two', '- three']);
  assert.deepEqual(carets.selections, [caret(0, 4), caret(2, 3)]);

  const reversed = toggleLines(['alpha', 'beta'], [selection(1, 2, 0, 1)], 'todo');
  assert.deepEqual(reversed.lines, ['- alpha', '- beta']);
  assert.deepEqual(reversed.selections, [selection(1, 4, 0, 3)]);
});

test('blank lines inside a selection become empty list items', () => {
  assert.deepEqual(
    toggleLines(['foo', '', 'bar'], [selection(0, 0, 2, 1)], 'todo'),
    {
      lines: ['- foo', '- ', '- bar'],
      selections: [selection(0, 2, 2, 3)],
    },
  );
});

test('extra spacing after a checkbox stays with the text', () => {
  assert.deepEqual(toggleLines(['- [ ]  foo'], [caret(0, 8)], 'todo'), {
    lines: ['- [x]  foo'],
    selections: [caret(0, 8)],
  });
});

test('list toggle cycles plain, bullet, and any numbered marker', () => {
  let lines = ['foo'];
  let selections = [caret(0, 2)];

  ({ lines, selections } = toggleLines(lines, selections, 'list'));
  assert.deepEqual(lines, ['- foo']);
  assert.deepEqual(selections, [caret(0, 4)]);

  ({ lines, selections } = toggleLines(lines, selections, 'list'));
  assert.deepEqual(lines, ['1. foo']);
  assert.deepEqual(selections, [caret(0, 5)]);

  ({ lines, selections } = toggleLines(lines, selections, 'list'));
  assert.deepEqual(lines, ['foo']);
  assert.deepEqual(selections, [caret(0, 2)]);

  assert.deepEqual(toggleLines(['2. foo'], [caret(0, 0)], 'list').lines, ['foo']);
  assert.deepEqual(toggleLines(['10. foo'], [caret(0, 4)], 'list'), {
    lines: ['foo'],
    selections: [caret(0, 0)],
  });
  assert.deepEqual(toggleLines(['* foo'], [caret(0, 3)], 'list'), {
    lines: ['1. foo'],
    selections: [caret(0, 4)],
  });
  assert.deepEqual(toggleLines(['- [ ] foo'], [caret(0, 7)], 'list'), {
    lines: ['- foo'],
    selections: [caret(0, 3)],
  });
  assert.deepEqual(toggleLines(['- [x] foo'], [caret(0, 7)], 'list'), {
    lines: ['- foo'],
    selections: [caret(0, 3)],
  });
});

test('a multi-line bullet selection becomes a sequential numbered list', () => {
  const result = toggleLines(
    ['- a', '- b', '- c'],
    [selection(0, 2, 2, 2)],
    'list',
  );
  assert.deepEqual(result.lines, ['1. a', '2. b', '3. c']);
  assert.deepEqual(result.selections, [selection(0, 3, 2, 3)]);
});

test('separate carets number independently and mixed lines keep their own next state', () => {
  const separate = toggleLines(
    ['- a', 'keep', '- c'],
    [caret(0, 2), caret(2, 2)],
    'list',
  );
  assert.deepEqual(separate.lines, ['1. a', 'keep', '1. c']);
  assert.deepEqual(separate.selections, [caret(0, 3), caret(2, 3)]);

  const mixed = toggleLines(
    ['- a', 'b', '- c'],
    [selection(0, 2, 2, 2)],
    'list',
  );
  assert.deepEqual(mixed.lines, ['1. a', '- b', '2. c']);
});

test('block quotes toggle one level and keep the caret in the text', () => {
  assert.deepEqual(toggleLines(['foo'], [caret(0, 1)], 'quote'), {
    lines: ['> foo'],
    selections: [caret(0, 3)],
  });
  assert.deepEqual(toggleLines(['> foo'], [caret(0, 3)], 'quote'), {
    lines: ['foo'],
    selections: [caret(0, 1)],
  });
  assert.deepEqual(toggleLines(['  foo'], [caret(0, 0)], 'quote'), {
    lines: ['  > foo'],
    selections: [caret(0, 4)],
  });
  assert.deepEqual(toggleLines(['  > foo'], [caret(0, 5)], 'quote'), {
    lines: ['  foo'],
    selections: [caret(0, 3)],
  });
  assert.deepEqual(toggleLines(['> > foo'], [caret(0, 5)], 'quote').lines, ['> foo']);
});

test('embed toggle only flips the bang on wikilinks and shifts the caret with the text', () => {
  assert.deepEqual(toggleLines(['[[note]]'], [caret(0, 2)], 'embed'), {
    lines: ['![[note]]'],
    selections: [caret(0, 3)],
  });
  assert.deepEqual(toggleLines(['[[note]]'], [caret(0, 0)], 'embed'), {
    lines: ['![[note]]'],
    selections: [caret(0, 1)],
  });
  assert.deepEqual(toggleLines(['![[note]]'], [caret(0, 0)], 'embed'), {
    lines: ['[[note]]'],
    selections: [caret(0, 0)],
  });
  assert.deepEqual(toggleLines(['![[note]]'], [caret(0, 1)], 'embed'), {
    lines: ['[[note]]'],
    selections: [caret(0, 0)],
  });
  assert.deepEqual(toggleLines(['![[note]]'], [caret(0, 3)], 'embed'), {
    lines: ['[[note]]'],
    selections: [caret(0, 2)],
  });
  assert.deepEqual(
    toggleLines(['see [[note]] and [[other]]'], [caret(0, 6)], 'embed'),
    {
      lines: ['see ![[note]] and ![[other]]'],
      selections: [caret(0, 7)],
    },
  );
  assert.deepEqual(toggleLines(['no link'], [caret(0, 3)], 'embed'), {
    lines: ['no link'],
    selections: [caret(0, 3)],
  });
});

test('an empty list item advances to an empty checkbox with the caret after the marker', () => {
  assert.deepEqual(toggleLines(['- '], [caret(0, 2)], 'todo'), {
    lines: ['- [ ] '],
    selections: [caret(0, 6)],
  });
  assert.deepEqual(toggleLines(['- [ ]'], [caret(0, 5)], 'todo'), {
    lines: ['- [x] '],
    selections: [caret(0, 6)],
  });
});

test('applying a to-do toggle writes the new line and caret through the editor', () => {
  const editor = fakeEditor(['foo'], [caret(0, 1)]);
  applyToggle(editor, 'todo');
  assert.deepEqual(editor.lines, ['- foo']);
  assert.deepEqual(editor.selections, [caret(0, 3)]);
});

function fakeEditor(lines: string[], selections: TextSelection[]): EditorSurface & {
  lines: string[];
  selections: TextSelection[];
} {
  return {
    lines: [...lines],
    selections: selections.map((sel) => ({
      anchor: { ...sel.anchor },
      head: { ...sel.head },
    })),
    lastLine() {
      return this.lines.length - 1;
    },
    getLine(line: number) {
      return this.lines[line] ?? '';
    },
    listSelections() {
      return this.selections;
    },
    transaction(tx: { changes: EditorChange[] }) {
      for (const change of tx.changes) {
        const current = this.lines[change.from.line] ?? '';
        const end = change.to?.ch ?? change.from.ch;
        this.lines[change.from.line] =
          current.slice(0, change.from.ch) + change.text + current.slice(end);
      }
    },
    setSelections(next: TextSelection[]) {
      this.selections = next;
    },
  };
}

test('editor updates replace only the lines that changed', () => {
  const update = buildEditorUpdate(['keep', 'foo', 'stay'], [caret(1, 1)], 'todo');
  assert.deepEqual(update.changes, [
    {
      from: { line: 1, ch: 0 },
      to: { line: 1, ch: 3 },
      text: '- foo',
    },
  ]);
  assert.deepEqual(update.selections, [caret(1, 3)]);

  const unchanged = buildEditorUpdate(['no link'], [caret(0, 1)], 'embed');
  assert.deepEqual(unchanged.changes, []);
  assert.deepEqual(unchanged.selections, [caret(0, 1)]);
});
