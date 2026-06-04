import { Setting } from 'obsidian';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab-base';
import { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';

import type { FilenameRule } from './PluginSettings.ts';
import type { PluginTypes } from './PluginTypes.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public override display(): void {
    super.display();
    this.containerEl.empty();

    this.containerEl.createEl('h3', { text: 'Rules' });
    this.containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: 'Evaluated top to bottom; first match wins. Empty "Match" applies to all files.'
    });

    this.renderRules();

    new Setting(this.containerEl)
      .addButton((btn) => {
        btn.setButtonText('Add rule').onClick(() => {
          (this.plugin.settings.rules as FilenameRule[]).push({
            matchPattern: '',
            stripPattern: '',
            targetField: 'aliases',
            fieldType: 'array'
          });
          void this.plugin.settingsManager.saveToFile();
          this.display();
        });
      });

    this.containerEl.createEl('h3', { text: 'Triggers' });

    new SettingEx(this.containerEl)
      .setName('Update on rename')
      .setDesc('When a note is renamed, find the previous derived value in frontmatter and update it.')
      .addToggle((toggle) => {
        this.bind(toggle, 'triggerOnRename');
      });

    new SettingEx(this.containerEl)
      .setName('Update on file open')
      .setDesc('Ensure the derived value exists in frontmatter whenever a note is opened.')
      .addToggle((toggle) => {
        this.bind(toggle, 'triggerOnOpen');
      });

    new SettingEx(this.containerEl)
      .setName('Update on save')
      .setDesc('Ensure the derived value exists in frontmatter whenever a note is saved (debounced 2 s).')
      .addToggle((toggle) => {
        this.bind(toggle, 'triggerOnSave');
      });
  }

  private renderRules(): void {
    const rules = this.plugin.settings.rules as FilenameRule[];

    if (rules.length === 0) {
      this.containerEl.createEl('p', { cls: 'setting-item-description', text: 'No rules defined.' });
      return;
    }

    rules.forEach((rule, i) => {
      // Row 1: name + match + strip + reorder/delete
      new Setting(this.containerEl)
        .setName(`Rule ${String(i + 1)}`)
        .addText((text) => {
          text
            .setPlaceholder('Match (regex, empty = all)')
            .setValue(rule.matchPattern)
            .onChange((value) => {
              (rules[i] as FilenameRule).matchPattern = value;
              void this.plugin.settingsManager.saveToFile();
            });
          text.inputEl.style.width = '13em';
        })
        .addText((text) => {
          text
            .setPlaceholder('Strip (regex)')
            .setValue(rule.stripPattern)
            .onChange((value) => {
              (rules[i] as FilenameRule).stripPattern = value;
              void this.plugin.settingsManager.saveToFile();
            });
          text.inputEl.style.width = '13em';
        })
        .addExtraButton((btn) => {
          btn.setIcon('arrow-up').setTooltip('Move up').onClick(() => {
            if (i === 0) return;
            [rules[i - 1], rules[i]] = [rules[i] as FilenameRule, rules[i - 1] as FilenameRule];
            void this.plugin.settingsManager.saveToFile();
            this.display();
          });
        })
        .addExtraButton((btn) => {
          btn.setIcon('arrow-down').setTooltip('Move down').onClick(() => {
            if (i === rules.length - 1) return;
            [rules[i], rules[i + 1]] = [rules[i + 1] as FilenameRule, rules[i] as FilenameRule];
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

      // Row 2: target field + field type (indented under the rule)
      new Setting(this.containerEl)
        .setDesc('Write result to:')
        .addText((text) => {
          text
            .setPlaceholder('frontmatter key (e.g. aliases, title)')
            .setValue(rule.targetField)
            .onChange((value) => {
              (rules[i] as FilenameRule).targetField = value;
              void this.plugin.settingsManager.saveToFile();
            });
          text.inputEl.style.width = '13em';
        })
        .addDropdown((dropdown) => {
          dropdown
            .addOption('array', 'array (upsert)')
            .addOption('value', 'value (overwrite)')
            .setValue(rule.fieldType)
            .onChange((value) => {
              (rules[i] as FilenameRule).fieldType = value as 'array' | 'value';
              void this.plugin.settingsManager.saveToFile();
            });
        });
    });
  }
}
