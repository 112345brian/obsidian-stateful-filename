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

    const pattern = this.settings.stripPattern;
    const oldBasename = pathBasenameNoExt(oldPath);
    const newBasename = (file as TFile).basename;
    const oldCleanTitle = applyStripPattern(oldBasename, pattern);
    const newCleanTitle = applyStripPattern(newBasename, pattern);

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
    const cleanTitle = applyStripPattern(file.basename, this.settings.stripPattern);
    const cached = this.app.metadataCache.getFileCache(file)?.frontmatter?.['aliases'] as unknown;
    if (normalizeAliases(cached).includes(cleanTitle)) return;

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

function applyStripPattern(basename: string, pattern: string): string {
  if (!pattern) return basename;
  try {
    const stripped = basename.replace(new RegExp(pattern), '').trim();
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
