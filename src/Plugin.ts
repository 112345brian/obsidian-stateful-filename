import type { App, TAbstractFile, TFile } from 'obsidian';

import { debounce } from 'obsidian';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-base';

import type { FilenameRule } from './PluginSettings.ts';
import type { PluginTypes } from './PluginTypes.ts';

import { PluginSettingsManager } from './PluginSettingsManager.ts';
import { PluginSettingsTab } from './PluginSettingsTab.ts';
import { applyStrip, testMatch } from './utils.ts';

interface RuleMatch {
  cleanValue: string;
  targetField: string;
  fieldType: 'array' | 'value';
}

// How long (ms) to ignore modify events on a file after we write to it.
// Covers our own processFrontMatter echo + any follow-up saves from Linter.
const WRITE_COOLDOWN_MS = 3000;

export class Plugin extends PluginBase<PluginTypes> {
  // Tracks files we recently wrote to so modify events from our own writes
  // (and follow-up writes by Linter) don't re-trigger us.
  private readonly writeCooldowns = new Map<string, number>();

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
      (file: TFile) => { void this.ensureField(file); },
      2000,
      true
    );

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (!this.settings.triggerOnSave || !isMdFile(file)) return;
        if (this.writeCooldowns.has(file.path)) return;
        if (isLinterLintOnSaveActive(this.app)) return;
        debouncedSave(file as TFile);
      })
    );
  }

  protected override async onunloadImpl(): Promise<void> {
    await super.onunloadImpl();
    for (const timer of this.writeCooldowns.values()) {
      window.clearTimeout(timer);
    }
    this.writeCooldowns.clear();
  }

  private setCooldown(path: string): void {
    const existing = this.writeCooldowns.get(path);
    if (existing !== undefined) window.clearTimeout(existing);
    this.writeCooldowns.set(path, window.setTimeout(() => { this.writeCooldowns.delete(path); }, WRITE_COOLDOWN_MS));
  }

  private async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
    if (!this.settings.triggerOnRename || !isMdFile(file)) return;

    const rules = this.settings.rules;
    const oldMatch = applyRules(pathBasenameNoExt(oldPath), rules);
    const newMatch = applyRules((file as TFile).basename, rules);

    if (oldMatch.cleanValue === newMatch.cleanValue && oldMatch.targetField === newMatch.targetField) return;

    this.setCooldown((file as TFile).path);
    await this.app.fileManager.processFrontMatter(file as TFile, (fm: unknown) => {
      const rec = fm as Record<string, unknown>;
      if (newMatch.fieldType === 'array') {
        upsertArrayField(rec, newMatch.targetField, oldMatch.cleanValue, newMatch.cleanValue);
      } else {
        rec[newMatch.targetField] = newMatch.cleanValue;
      }
    });
  }

  private async handleFileOpen(file: TFile | null): Promise<void> {
    if (!this.settings.triggerOnOpen || !file || file.extension !== 'md') return;
    await this.ensureField(file);
  }

  private async ensureField(file: TFile): Promise<void> {
    const match = applyRules(file.basename, this.settings.rules);
    const cached = this.app.metadataCache.getFileCache(file)?.frontmatter?.[match.targetField] as unknown;

    if (match.fieldType === 'array') {
      if (normalizeArray(cached).includes(match.cleanValue)) return;
    } else {
      if (cached === match.cleanValue) return;
    }

    this.setCooldown(file.path);
    await this.app.fileManager.processFrontMatter(file, (fm: unknown) => {
      const rec = fm as Record<string, unknown>;
      if (match.fieldType === 'array') {
        upsertArrayField(rec, match.targetField, undefined, match.cleanValue);
      } else {
        rec[match.targetField] = match.cleanValue;
      }
    });
  }
}

function isLinterLintOnSaveActive(app: App): boolean {
  const plugins = (app as unknown as { plugins?: { plugins?: Record<string, { settings?: { lintOnSave?: boolean } }> } }).plugins;
  return plugins?.plugins?.['obsidian-linter']?.settings?.lintOnSave === true;
}

function isMdFile(file: TAbstractFile): boolean {
  return 'extension' in file && (file as TFile).extension === 'md';
}

function pathBasenameNoExt(filePath: string): string {
  const base = filePath.split('/').at(-1) ?? filePath;
  return base.endsWith('.md') ? base.slice(0, -3) : base;
}

function applyRules(basename: string, rules: readonly FilenameRule[]): RuleMatch {
  for (const rule of rules) {
    const hasPattern = rule.mode === 'simple' ? !!rule.stripFormat : !!rule.stripPattern;
    if (!hasPattern) continue;
    if (!testMatch(basename, rule.mode === 'advanced' ? rule.matchPattern : '')) continue;
    const stripped = applyStrip(basename, rule.mode, rule.stripFormat, rule.stripPattern);
    if (stripped !== basename) {
      return {
        cleanValue: stripped,
        targetField: rule.targetField || 'aliases',
        fieldType: rule.fieldType
      };
    }
  }
  return { cleanValue: basename, targetField: 'aliases', fieldType: 'array' };
}

function normalizeArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') return [value];
  return [];
}

function upsertArrayField(
  fm: Record<string, unknown>,
  field: string,
  oldValue: string | undefined,
  newValue: string
): void {
  const arr = normalizeArray(fm[field] as unknown);

  if (oldValue !== undefined) {
    const idx = arr.indexOf(oldValue);
    if (idx !== -1) {
      arr[idx] = newValue;
      fm[field] = arr;
      return;
    }
  }

  if (!arr.includes(newValue)) {
    arr.push(newValue);
    fm[field] = arr;
  }
}
