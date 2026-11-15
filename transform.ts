export interface Position {
  line: number;
  ch: number;
}

export interface TextSelection {
  anchor: Position;
  head: Position;
}

export type ToggleMode = 'todo' | 'list' | 'quote' | 'embed';

export interface EditorChange {
  from: Position;
  to?: Position;
  text: string;
}

export interface EditorUpdate {
  changes: EditorChange[];
  selections: TextSelection[];
}

export interface EditorSurface {
  lastLine(): number;
  getLine(line: number): string;
  listSelections(): TextSelection[];
  transaction(tx: { changes: EditorChange[] }): void;
  setSelections(selections: TextSelection[]): void;
}

type ListKind = 'plain' | 'bullet' | 'todo' | 'done' | 'ordered';

interface ParsedList {
  indent: string;
  kind: ListKind;
  content: string;
  contentStart: number;
}

interface LineResult {
  text: string;
  mapCh: (oldCh: number) => number;
}

/** plain → `- ` → `- [ ] ` → `- [x] ` → `- ` */
function todoMarker(kind: ListKind): string {
  if (kind === 'bullet') return '- [ ] ';
  if (kind === 'todo') return '- [x] ';
  return '- ';
}

function indentOf(line: string): string {
  let index = 0;
  while (index < line.length && (line[index] === ' ' || line[index] === '\t')) {
    index++;
  }
  return line.slice(0, index);
}

function parseList(line: string): ParsedList {
  const indent = indentOf(line);
  const rest = line.slice(indent.length);
  const checkbox = /^([-*+])[ \t]\[([ xX])\]/.exec(rest);
  if (checkbox) {
    let content = rest.slice(checkbox[0].length);
    let consumed = checkbox[0].length;
    if (content.startsWith(' ') || content.startsWith('\t')) {
      content = content.slice(1);
      consumed += 1;
    }
    const checked = (checkbox[2] ?? '').toLowerCase() === 'x';
    return {
      indent,
      kind: checked ? 'done' : 'todo',
      content,
      contentStart: indent.length + consumed,
    };
  }

  const bullet = /^([-*+])[ \t]/.exec(rest);
  if (bullet) {
    return {
      indent,
      kind: 'bullet',
      content: rest.slice(bullet[0].length),
      contentStart: indent.length + bullet[0].length,
    };
  }

  const ordered = /^(\d+)\.[ \t]/.exec(rest);
  if (ordered) {
    return {
      indent,
      kind: 'ordered',
      content: rest.slice(ordered[0].length),
      contentStart: indent.length + ordered[0].length,
    };
  }

  return {
    indent,
    kind: 'plain',
    content: rest,
    contentStart: indent.length,
  };
}

function mapPrefixCaret(
  oldCh: number,
  oldStart: number,
  newStart: number,
  newLength: number,
): number {
  const safeOld = Math.max(0, oldCh);
  if (safeOld < oldStart) return Math.min(newStart, newLength);
  const mapped = newStart + (safeOld - oldStart);
  return Math.max(newStart, Math.min(mapped, newLength));
}

function prefixResult(oldStart: number, text: string, newStart: number): LineResult {
  return {
    text,
    mapCh: (oldCh: number) => mapPrefixCaret(oldCh, oldStart, newStart, text.length),
  };
}

function toggleTodoLine(line: string): LineResult {
  const parsed = parseList(line);
  const marker = todoMarker(parsed.kind);
  const text = parsed.indent + marker + parsed.content;
  return prefixResult(parsed.contentStart, text, parsed.indent.length + marker.length);
}

function toggleListLine(line: string, counter: { n: number }): LineResult {
  const parsed = parseList(line);
  if (parsed.kind === 'bullet') {
    const marker = `${counter.n++}. `;
    const text = parsed.indent + marker + parsed.content;
    return prefixResult(parsed.contentStart, text, parsed.indent.length + marker.length);
  }
  if (parsed.kind === 'ordered') {
    const text = parsed.indent + parsed.content;
    return prefixResult(parsed.contentStart, text, parsed.indent.length);
  }
  const marker = '- ';
  const text = parsed.indent + marker + parsed.content;
  return prefixResult(parsed.contentStart, text, parsed.indent.length + marker.length);
}

function toggleQuoteLine(line: string): LineResult {
  const indent = indentOf(line);
  const rest = line.slice(indent.length);
  if (rest.startsWith('>')) {
    let content = rest.slice(1);
    let oldStart = indent.length + 1;
    if (content.startsWith(' ') || content.startsWith('\t')) {
      content = content.slice(1);
      oldStart += 1;
    }
    return prefixResult(oldStart, indent + content, indent.length);
  }
  return prefixResult(indent.length, `${indent}> ${rest}`, indent.length + 2);
}

function toggleEmbedLine(line: string): LineResult {
  let text = '';
  const edits: { index: number; delta: 1 | -1 }[] = [];
  for (let index = 0; index < line.length; ) {
    if (line.startsWith('![[', index)) {
      text += '[[';
      edits.push({ index, delta: -1 });
      index += 3;
    } else if (line.startsWith('[[', index)) {
      text += '![[';
      edits.push({ index, delta: 1 });
      index += 2;
    } else {
      text += line[index] ?? '';
      index += 1;
    }
  }

  return {
    text,
    mapCh: (oldCh: number) => {
      let shift = 0;
      for (const edit of edits) {
        if (edit.delta > 0) {
          if (oldCh >= edit.index) shift += 1;
        } else if (oldCh > edit.index) {
          shift -= 1;
        }
      }
      return Math.max(0, Math.min(text.length, oldCh + shift));
    },
  };
}

function lineSpan(
  selection: TextSelection,
  lineCount: number,
): { start: number; end: number } | null {
  if (lineCount <= 0) return null;
  const forward =
    selection.anchor.line < selection.head.line ||
    (selection.anchor.line === selection.head.line &&
      selection.anchor.ch <= selection.head.ch);
  const from = forward ? selection.anchor : selection.head;
  const to = forward ? selection.head : selection.anchor;
  const start = Math.min(Math.max(from.line, 0), lineCount - 1);
  let end = Math.min(Math.max(to.line, 0), lineCount - 1);
  if (to.line > from.line && to.ch === 0) {
    end = Math.min(end, to.line - 1);
  }
  if (end < start) return null;
  return { start, end };
}

function identityResult(line: string): LineResult {
  return {
    text: line,
    mapCh: (oldCh: number) => Math.max(0, Math.min(line.length, oldCh)),
  };
}

function mapPosition(position: Position, results: LineResult[]): Position {
  const result = results[position.line];
  if (!result) return { line: position.line, ch: Math.max(0, position.ch) };
  return { line: position.line, ch: result.mapCh(position.ch) };
}

export function toggleLines(
  lines: string[],
  selections: TextSelection[],
  mode: ToggleMode,
): { lines: string[]; selections: TextSelection[] } {
  const results = lines.map((line) => identityResult(line));
  const claimed = new Set<number>();

  for (const selection of selections) {
    const span = lineSpan(selection, lines.length);
    if (!span) continue;
    const counter = { n: 1 };
    for (let line = span.start; line <= span.end; line++) {
      if (claimed.has(line)) continue;
      claimed.add(line);
      const text = lines[line] ?? '';
      if (mode === 'todo') results[line] = toggleTodoLine(text);
      else if (mode === 'list') results[line] = toggleListLine(text, counter);
      else if (mode === 'quote') results[line] = toggleQuoteLine(text);
      else results[line] = toggleEmbedLine(text);
    }
  }

  return {
    lines: results.map((result) => result.text),
    selections: selections.map((selection) => ({
      anchor: mapPosition(selection.anchor, results),
      head: mapPosition(selection.head, results),
    })),
  };
}

export function buildEditorUpdate(
  lines: string[],
  selections: TextSelection[],
  mode: ToggleMode,
): EditorUpdate {
  const next = toggleLines(lines, selections, mode);
  const changes: EditorChange[] = [];
  for (let line = 0; line < lines.length; line++) {
    const before = lines[line] ?? '';
    const after = next.lines[line] ?? '';
    if (before !== after) {
      changes.push({
        from: { line, ch: 0 },
        to: { line, ch: before.length },
        text: after,
      });
    }
  }
  return { changes, selections: next.selections };
}

export function applyToggle(editor: EditorSurface, mode: ToggleMode): void {
  const lineCount = editor.lastLine() + 1;
  const lines: string[] = [];
  for (let line = 0; line < lineCount; line++) lines.push(editor.getLine(line));
  const selections = editor.listSelections().map((selection) => ({
    anchor: { line: selection.anchor.line, ch: selection.anchor.ch },
    head: { line: selection.head.line, ch: selection.head.ch },
  }));
  const update = buildEditorUpdate(lines, selections, mode);
  if (update.changes.length > 0) editor.transaction({ changes: update.changes });
  editor.setSelections(update.selections);
}
