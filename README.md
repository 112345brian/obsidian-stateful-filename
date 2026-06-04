# Stateful Filename

[![GitHub release](https://img.shields.io/github/v/release/112345brian/obsidian-stateful-filename)](https://github.com/112345brian/obsidian-stateful-filename/releases)
[![GitHub downloads](https://img.shields.io/github/downloads/112345brian/obsidian-stateful-filename/total)](https://github.com/112345brian/obsidian-stateful-filename/releases)

An [Obsidian](https://obsidian.md/) plugin that keeps a derived frontmatter value in sync with the note's filename. Define rules that strip a prefix (e.g. a timestamp) from the filename and write the clean result to any frontmatter field.

**Example:** A file named `260604_112629 project kickoff` automatically gets `aliases: [project kickoff]` — and when you rename it to `260604_141500 project kickoff revised`, the alias updates in place.

## How it works

You define one or more rules. Each rule:
1. Optionally tests whether the filename matches a pattern
2. Strips a prefix from the filename to derive a clean value
3. Writes that value to a frontmatter field (as an array entry or scalar)

Rules are evaluated top to bottom — the first match wins.

## Configuration

### Rules

Each rule has a **mode**:

**Simple (moment.js)** — strips a date/time prefix by format string.

| Format | Matches filenames like |
|---|---|
| `YYYY-MM-DD` | `2026-06-04 my note` |
| `YYMMDD_HHmmss` | `260604_112629 my note` |
| `YYYYMMDDHHmm` | `202606041126 my note` |

Uses [moment.js format tokens](https://momentjs.com/docs/#/parsing/string-format/). Trailing whitespace is consumed automatically.

**Advanced (regex)** — full control with two fields:
- **Match pattern** — regex the filename must satisfy to trigger this rule (leave empty to match all files)
- **Strip pattern** — regex removed from the filename to produce the clean value

Each rule also specifies:
- **Target field** — which frontmatter key to write to (default: `aliases`)
- **Write as** — `array (upsert)` keeps other values intact and adds/updates the derived value; `value (overwrite)` replaces the field entirely

### Sandbox

Each rule has a live test input — type any filename to preview what the rule produces before it touches your notes.

### Triggers

| Trigger | Behavior |
|---|---|
| **Update on rename** | When a note is renamed, finds the previous derived value in frontmatter and replaces it with the new one |
| **Update on file open** | Ensures the derived value exists whenever a note is opened |
| **Update on save** | Ensures the derived value exists whenever a note is saved (debounced 2 s) |

### Linter compatibility

If [Obsidian Linter](https://github.com/platers/obsidian-linter) is installed with "Lint on save" enabled, **Update on save** is automatically disabled to prevent a save loop.

## Installation

### Manual

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/112345brian/obsidian-stateful-filename/releases/latest)
2. Copy both files to `.obsidian/plugins/stateful-filename/` in your vault
3. Enable the plugin in Settings → Community plugins

### BRAT

Add `112345brian/obsidian-stateful-filename` via [BRAT](https://github.com/TfTHacker/obsidian42-brat).

## License

GPL-3.0 © 112345brian
