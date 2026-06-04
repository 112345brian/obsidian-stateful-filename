import type { TAbstractFile, TFile } from 'obsidian';

import { debounce } from 'obsidian';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-base';

import type { FilenameRule } from './PluginSettings.ts';
import type { PluginTypes } from './PluginTypes.ts';

import { PluginSettingsManager } from './PluginSettingsManager.ts';
import { PluginSettingsTab } from './PluginSettingsTab.ts';

interface RuleMatch {
  cleanValue: string;
  targetField: string;
  fieldType: 'array' | 'value';
}

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
      (file: TFile) => { void this.ensureField(file); },
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

    const rules = this.settings.rules;
    const oldMatch = applyRules(pathBasenameNoExt(oldPath), rules);
    const newMatch = applyRules((file as TFile).basename, rules);

    if (oldMatch.cleanValue === newMatch.cleanValue && oldMatch.targetField === newMatch.targetField) return;

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

function isMdFile(file: TAbstractFile): boolean {
  return 'extension' in file && (file as TFile).extension === 'md';
}

function pathBasenameNoExt(filePath: string): string {
  const base = filePath.split('/').at(-1) ?? filePath;
  return base.endsWith('.md') ? base.slice(0, -3) : base;
}

function applyRules(basename: string, rules: readonly FilenameRule[]): RuleMatch {
  for (const rule of rules) {
    if (!rule.stripPattern) continue;
    try {
      if (rule.matchPattern && !new RegExp(rule.matchPattern).test(basename)) continue;
      const stripped = basename.replace(new RegExp(rule.stripPattern), '').trim();
      if (stripped.length > 0) {
        return {
          cleanValue: stripped,
          targetField: rule.targetField || 'aliases',
          fieldType: rule.fieldType
        };
      }
    } catch {
      // invalid regex — skip this rule
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
