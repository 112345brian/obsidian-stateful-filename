import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab-base';
import { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';

import type { PluginTypes } from './PluginTypes.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public override display(): void {
    super.display();
    this.containerEl.empty();

    new SettingEx(this.containerEl)
      .setName('Timestamp format')
      .setDesc('Moment.js format of the timestamp prefix in your filenames (e.g. YYYY-MM-DD, YYYYMMDDHHmm).')
      .addMomentFormat((momentFormat) => {
        this.bind(momentFormat, 'timestampFormat');
      });

    new SettingEx(this.containerEl)
      .setName('Update alias on rename')
      .setDesc('When a note is renamed, find the alias matching the previous clean title and update it.')
      .addToggle((toggle) => {
        this.bind(toggle, 'triggerOnRename');
      });

    new SettingEx(this.containerEl)
      .setName('Update alias on file open')
      .setDesc('Ensure the clean title alias exists whenever a note is opened.')
      .addToggle((toggle) => {
        this.bind(toggle, 'triggerOnOpen');
      });

    new SettingEx(this.containerEl)
      .setName('Update alias on save')
      .setDesc('Ensure the clean title alias exists whenever a note is saved (debounced 2 s).')
      .addToggle((toggle) => {
        this.bind(toggle, 'triggerOnSave');
      });
  }
}
