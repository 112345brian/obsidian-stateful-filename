import { PluginSettingsManagerBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-manager-base';

import type { FilenameRule } from './PluginSettings.ts';
import type { PluginTypes } from './PluginTypes.ts';

import { PluginSettings } from './PluginSettings.ts';

export class PluginSettingsManager extends PluginSettingsManagerBase<PluginTypes> {
  protected override createDefaultSettings(): PluginSettings {
    return new PluginSettings();
  }

  protected override async onLoadRecord(record: Record<string, unknown>): Promise<void> {
    await super.onLoadRecord(record);
    const settings = record as Partial<PluginSettings>;
    // Migrate rules saved before the mode field existed: if a rule has a
    // stripPattern but no mode, treat it as advanced.
    if (Array.isArray(settings.rules)) {
      for (const rule of settings.rules as Partial<FilenameRule>[]) {
        if (rule.mode === undefined) {
          rule.mode = rule.stripPattern ? 'advanced' : 'simple';
          rule.stripFormat ??= 'YYYY-MM-DD';
          rule.matchPattern ??= '';
        }
      }
    }
  }
}
