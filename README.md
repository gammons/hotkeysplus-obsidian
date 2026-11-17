# hotkeysplus-obsidian

Hotkeys for a few edits that come up constantly in [Obsidian](https://obsidian.md/): cycling tasks and lists, toggling quotes and embeds, and duplicating or clearing lines.

This is a maintained fork of [argenos/hotkeysplus-obsidian](https://github.com/argenos/hotkeysplus-obsidian). Upstream has not published a build since 2021. Obsidian 1.15 dropped ES5, and the old bundle cannot construct its plugin class, so Obsidian reports `Class constructor cannot be invoked without 'new'` and refuses to enable the plugin. This fork compiles to ES2021 and talks to the editor through Obsidian's Editor API.

Requires Obsidian 1.15.0 or newer.

## To-do cycle

`Toggle to-do lists` is bound to <kbd>Ctrl</kbd>+<kbd>M</kbd> (<kbd>Cmd</kbd>+<kbd>M</kbd> on macOS) by default. You can change that in **Settings → Hotkeys**. Each press on a line advances:

| Current line | After one press |
| --- | --- |
| `foo` | `- [ ] foo` |
| `- [ ] foo` | `- [x] foo` |
| `- [x] foo` | `- foo` |
| `- foo` | `- [ ] foo` |

Indentation stays put. A selection that covers several lines cycles each of those lines. The caret stays on the same character of the text, and it never ends up before the new marker, so an empty line is ready to type.

`Toggle line to bulleted or numbered lists` (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>) cycles `foo` → `- foo` → `1. foo` → `foo`. A multi-line selection of bullets becomes `1.`, `2.`, `3.`, and any numbered marker (`2.`, `10.`, …) counts as numbered.

## Other commands

| Default hotkey | Action |
| --- | --- |
| <kbd>Ctrl</kbd>+<kbd>M</kbd> | Cycle a line through an open checkbox, a checked checkbox, and a bullet |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> | Cycle a line through a bullet and a numbered list |
| <kbd>Ctrl</kbd>+<kbd>&lt;</kbd> | Toggle a block quote |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>1</kbd> | Toggle `!` on internal embeds |
| unset | Copy line(s) down |
| unset | Copy line(s) up |
| unset | Insert a line below or above the current line |
| unset | Clear the current line |
| unset | Trim the selection and join it onto one line |
| unset | Toggle readable line length |

## Install manually

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/gammons/hotkeysplus-obsidian/releases/latest).
2. Close Obsidian.
3. Copy both files into `<vault>/.obsidian/plugins/hotkeysplus-obsidian/`, replacing anything already there. Create the folder if this is a new install. The folder name has to match the plugin id.
4. Open the vault and enable **Hotkeys++** under **Settings → Community plugins**. If it was already installed, turn it off and on once so Obsidian reloads `main.js`.
5. Confirm the binding under **Settings → Hotkeys**. Search for `Toggle to-do lists`.

Do not copy `main.js` from a source checkout unless you have built it. The file in the release is the one Obsidian loads.

## Install with BRAT

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installs a plugin from a GitHub release. The release must attach `main.js` and `manifest.json` as separate files, which the releases on this fork do.

1. Install **BRAT** from **Settings → Community plugins → Browse**.
2. Open **Settings → BRAT** and choose **Add beta plugin**.
3. Enter `gammons/hotkeysplus-obsidian` and add it.
4. Enable **Hotkeys++** under Community plugins.
5. When a newer release is published, use BRAT's **Check for updates** (or wait for its check) and reload Obsidian.

## Build from source

```bash
npm install
npm test
npm run build
```

`npm run build` typechecks, bundles `main.ts` to `main.js` with an ES2021 target, and checks that the bundle is a native `class` rather than an ES5 subclass. `npm run dev` rebuilds while you edit.
