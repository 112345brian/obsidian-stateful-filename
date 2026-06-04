import { Setting } from 'obsidian';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab-base';
import { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';

import type { PluginTypes } from './PluginTypes.ts';

import type { AliasRule } from './PluginSettings.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public override display(): void {
    super.display();
    this.containerEl.empty();

    this.containerEl.createEl('h3', { text: 'Rules' });
    this.containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: 'Rules are evaluated top to bottom; the first match wins. Leave "Match" empty to match all files.'
    });

    this.renderRules();

    new Setting(this.containerEl)
      .addButton((btn) => {
        btn.setButtonText('Add rule').onClick(() => {
          (this.plugin.settings.rules as AliasRule[]).push({ matchPattern: '', stripPattern: '' });
          void this.plugin.settingsManager.saveToFile();
          this.display();
        });
      });

    this.containerEl.createEl('h3', { text: 'Triggers' });

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

  private renderRules(): void {
    const rules = this.plugin.settings.rules as AliasRule[];

    if (rules.length === 0) {
      this.containerEl.createEl('p', {
        cls: 'setting-item-description',
        text: 'No rules defined. Add one below.'
      });
      return;
    }

    rules.forEach((rule, i) => {
      new Setting(this.containerEl)
        .setName(`Rule ${String(i + 1)}`)
        .addText((text) => {
          text
            .setPlaceholder('Match (regex, empty = all)')
            .setValue(rule.matchPattern)
            .onChange((value) => {
              (rules[i] as AliasRule).matchPattern = value;
              void this.plugin.settingsManager.saveToFile();
            });
          text.inputEl.style.width = '14em';
        })
        .addText((text) => {
          text
            .setPlaceholder('Strip (regex)')
            .setValue(rule.stripPattern)
            .onChange((value) => {
              (rules[i] as AliasRule).stripPattern = value;
              void this.plugin.settingsManager.saveToFile();
            });
          text.inputEl.style.width = '18em';
        })
        .addExtraButton((btn) => {
          btn.setIcon('arrow-up').setTooltip('Move up').onClick(() => {
            if (i === 0) return;
            [rules[i - 1], rules[i]] = [rules[i] as AliasRule, rules[i - 1] as AliasRule];
            void this.plugin.settingsManager.saveToFile();
            this.display();
          });
        })
        .addExtraButton((btn) => {
          btn.setIcon('arrow-down').setTooltip('Move down').onClick(() => {
            if (i === rules.length - 1) return;
            [rules[i], rules[i + 1]] = [rules[i + 1] as AliasRule, rules[i] as AliasRule];
            void this.plugin.settingsManager.saveToFile();
            this.display();
          });
        })
        .addExtraButton((btn) => {
          btn.setIcon('trash').setTooltip('Delete').onClick(() => {
            rules.splice(i, 1);
            void this.plugin.settingsManager.saveToFile();
            this.display();
          });
        });
    });
  }
}
