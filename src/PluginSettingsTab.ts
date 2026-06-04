import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab-base';
import { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';

import type { PluginTypes } from './PluginTypes.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public override display(): void {
    super.display();
    this.containerEl.empty();

    new SettingEx(this.containerEl)
      .setName('Strip pattern')
      .setDesc('JavaScript regex applied to the filename (without extension) to derive the clean alias. The matched portion is removed. Default strips an ISO date prefix.')
      .addText((text) => {
        text.setPlaceholder('^\\d{4}-\\d{2}-\\d{2}\\s*');
        this.bind(text, 'stripPattern');
      });

    new SettingEx(this.containerEl)
      .setName('Update alias on rename')
      .setDesc('When a note is renamed, find the alias matching the previous clean title and update it.')
      .addToggle((toggle) => {
        this.bind(toggle, 'triggerOnRename');
      });

    new SettingEx(this.containerEl)
      .setName('Update alias on file open')
      .setDesc('Ensure the clean alias exists whenever a note is opened.')
      .addToggle((toggle) => {
        this.bind(toggle, 'triggerOnOpen');
      });

    new SettingEx(this.containerEl)
      .setName('Update alias on save')
      .setDesc('Ensure the clean alias exists whenever a note is saved (debounced 2 s).')
      .addToggle((toggle) => {
        this.bind(toggle, 'triggerOnSave');
      });
  }
}
