import type { TAbstractFile, TFile } from 'obsidian';

import { debounce } from 'obsidian';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-base';

import type { PluginTypes } from './PluginTypes.ts';

import { PluginSettingsManager } from './PluginSettingsManager.ts';
import { PluginSettingsTab } from './PluginSettingsTab.ts';

export class Plugin extends PluginBase<PluginTypes> {
  protected override createSettingsManager(): PluginSettingsManager {
    return new PluginSettingsManager(this);
  }

  protected override createSettingsTab(): PluginSettingsTab {
    return new PluginSettingsTab(this);
  }

  protected override async onloadImpl(): Promise<void> {
    await super.onloadImpl();

    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        void this.handleRename(file, oldPath);
      })
    );

    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        void this.handleFileOpen(file);
      })
    );

    const debouncedSave = debounce(
      (file: TFile) => { void this.ensureAlias(file); },
      2000,
      true
    );

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (this.settings.triggerOnSave && isMdFile(file)) {
          debouncedSave(file as TFile);
        }
      })
    );
  }

  private async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
    if (!this.settings.triggerOnRename || !isMdFile(file)) return;

    const format = this.settings.timestampFormat;
    const oldBasename = pathBasenameNoExt(oldPath);
    const newBasename = (file as TFile).basename;
    const oldCleanTitle = stripTimestamp(oldBasename, format);
    const newCleanTitle = stripTimestamp(newBasename, format);

    if (oldCleanTitle === newCleanTitle) return;

    await this.app.fileManager.processFrontMatter(file as TFile, (fm: unknown) => {
      upsertAlias(fm as Record<string, unknown>, oldCleanTitle, newCleanTitle);
    });
  }

  private async handleFileOpen(file: TFile | null): Promise<void> {
    if (!this.settings.triggerOnOpen || !file || file.extension !== 'md') return;
    await this.ensureAlias(file);
  }

  private async ensureAlias(file: TFile): Promise<void> {
    const cleanTitle = stripTimestamp(file.basename, this.settings.timestampFormat);
    const cached = this.app.metadataCache.getFileCache(file)?.frontmatter?.['aliases'] as unknown;
    const existing = normalizeAliases(cached);
    if (existing.includes(cleanTitle)) return;

    await this.app.fileManager.processFrontMatter(file, (fm: unknown) => {
      upsertAlias(fm as Record<string, unknown>, undefined, cleanTitle);
    });
  }
}

function isMdFile(file: TAbstractFile): boolean {
  return 'extension' in file && (file as TFile).extension === 'md';
}

function pathBasenameNoExt(filePath: string): string {
  const base = filePath.split('/').at(-1) ?? filePath;
  return base.endsWith('.md') ? base.slice(0, -3) : base;
}

function momentFormatToRegex(format: string): RegExp {
  // Longest tokens first so e.g. YYYY matches before YY
  const tokens: [string, string][] = [
    ['YYYY', '\\d{4}'],
    ['SSS', '\\d{3}'],
    ['YY', '\\d{2}'],
    ['MM', '\\d{2}'],
    ['DD', '\\d{2}'],
    ['HH', '\\d{2}'],
    ['hh', '\\d{2}'],
    ['mm', '\\d{2}'],
    ['ss', '\\d{2}'],
    ['M', '\\d{1,2}'],
    ['D', '\\d{1,2}'],
    ['H', '\\d{1,2}'],
    ['h', '\\d{1,2}'],
    ['m', '\\d{1,2}'],
    ['s', '\\d{1,2}'],
    ['X', '\\d+'],
    ['x', '\\d+'],
  ];

  let pattern = '';
  let i = 0;
  while (i < format.length) {
    let matched = false;
    for (const [token, re] of tokens) {
      if (format.startsWith(token, i)) {
        pattern += re;
        i += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      pattern += (format[i] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i++;
    }
  }

  return new RegExp(`^${pattern}\\s*`);
}

function stripTimestamp(basename: string, format: string): string {
  try {
    const stripped = basename.replace(momentFormatToRegex(format), '').trim();
    return stripped.length > 0 ? stripped : basename;
  } catch {
    return basename;
  }
}

function normalizeAliases(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') return [value];
  return [];
}

function upsertAlias(fm: Record<string, unknown>, oldAlias: string | undefined, newAlias: string): void {
  const aliases = normalizeAliases(fm['aliases'] as unknown);

  if (oldAlias !== undefined) {
    const idx = aliases.indexOf(oldAlias);
    if (idx !== -1) {
      aliases[idx] = newAlias;
      fm['aliases'] = aliases;
      return;
    }
  }

  if (!aliases.includes(newAlias)) {
    aliases.push(newAlias);
    fm['aliases'] = aliases;
  }
}
