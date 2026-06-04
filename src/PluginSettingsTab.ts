import { Setting } from 'obsidian';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab-base';
import { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';

import type { FilenameRule } from './PluginSettings.ts';
import type { PluginTypes } from './PluginTypes.ts';

import { applyStrip, testMatch } from './utils.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public override display(): void {
    super.display();
    this.containerEl.empty();

    this.containerEl.createEl('h3', { text: 'Rules' });
    this.containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: 'Evaluated top to bottom; first match wins.'
    });

    this.renderRules();

    new Setting(this.containerEl)
      .addButton((btn) => {
        btn.setButtonText('Add rule').onClick(() => {
          (this.plugin.settings.rules as FilenameRule[]).push({
            mode: 'simple',
            stripFormat: 'YYYY-MM-DD',
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
      .addToggle((toggle) => { this.bind(toggle, 'triggerOnRename'); });

    new SettingEx(this.containerEl)
      .setName('Update on file open')
      .setDesc('Ensure the derived value exists in frontmatter whenever a note is opened.')
      .addToggle((toggle) => { this.bind(toggle, 'triggerOnOpen'); });

    new SettingEx(this.containerEl)
      .setName('Update on save')
      .setDesc('Ensure the derived value exists whenever a note is saved (debounced 2 s). Avoid enabling if Linter\'s "Lint on save" is active.')
      .addToggle((toggle) => { this.bind(toggle, 'triggerOnSave'); });
  }

  private renderRules(): void {
    const rules = this.plugin.settings.rules as FilenameRule[];

    if (rules.length === 0) {
      this.containerEl.createEl('p', { cls: 'setting-item-description', text: 'No rules defined.' });
      return;
    }

    rules.forEach((rule, i) => {
      // ── Row 1: header + mode toggle + reorder/delete ──────────────────────
      new Setting(this.containerEl)
        .setName(`Rule ${String(i + 1)}`)
        .addDropdown((dd) => {
          dd.addOption('simple', 'Simple (date format)')
            .addOption('advanced', 'Advanced (regex)')
            .setValue(rule.mode)
            .onChange((value) => {
              (rules[i] as FilenameRule).mode = value as 'simple' | 'advanced';
              void this.plugin.settingsManager.saveToFile();
              this.display();
            });
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

      // ── Row 2: pattern inputs (mode-dependent) ────────────────────────────
      if (rule.mode === 'simple') {
        new SettingEx(this.containerEl)
          .setName('Date format')
          .setDesc('Moment.js format of the date prefix to strip (e.g. YYYY-MM-DD, YYYYMMDDHHmm).')
          .addMomentFormat((mf) => {
            mf.setPlaceholder('YYYY-MM-DD')
              .setValue(rule.stripFormat)
              .onChange((value) => {
                (rules[i] as FilenameRule).stripFormat = value;
                void this.plugin.settingsManager.saveToFile();
              });
          });
      } else {
        new Setting(this.containerEl)
          .setName('Match & strip')
          .setDesc('Match: regex the filename must satisfy (empty = all files). Strip: regex removed from the filename.')
          .addText((text) => {
            text.setPlaceholder('Match (empty = all)')
              .setValue(rule.matchPattern)
              .onChange((value) => {
                (rules[i] as FilenameRule).matchPattern = value;
                void this.plugin.settingsManager.saveToFile();
              });
            text.inputEl.style.width = '13em';
          })
          .addText((text) => {
            text.setPlaceholder('Strip regex')
              .setValue(rule.stripPattern)
              .onChange((value) => {
                (rules[i] as FilenameRule).stripPattern = value;
                void this.plugin.settingsManager.saveToFile();
              });
            text.inputEl.style.width = '13em';
          });
      }

      // ── Row 3: write target ───────────────────────────────────────────────
      new Setting(this.containerEl)
        .setDesc('Write result to:')
        .addText((text) => {
          text.setPlaceholder('frontmatter key (e.g. aliases, title)')
            .setValue(rule.targetField)
            .onChange((value) => {
              (rules[i] as FilenameRule).targetField = value;
              void this.plugin.settingsManager.saveToFile();
            });
          text.inputEl.style.width = '13em';
        })
        .addDropdown((dd) => {
          dd.addOption('array', 'array (upsert)')
            .addOption('value', 'value (overwrite)')
            .setValue(rule.fieldType)
            .onChange((value) => {
              (rules[i] as FilenameRule).fieldType = value as 'array' | 'value';
              void this.plugin.settingsManager.saveToFile();
            });
        });

      // ── Row 4: live sandbox ───────────────────────────────────────────────
      this.renderSandbox(rule, i);
    });
  }

  private renderSandbox(_rule: FilenameRule, ruleIndex: number): void {
    const setting = new Setting(this.containerEl).setDesc('Test:');

    const testInput = setting.controlEl.createEl('input', { type: 'text' });
    testInput.placeholder = 'Type a filename to preview…';
    testInput.style.cssText = 'width:16em; margin-right:0.5em;';

    const resultEl = setting.controlEl.createEl('span');
    resultEl.style.cssText = 'opacity:0.7; font-style:italic;';

    const rules = this.plugin.settings.rules as FilenameRule[];

    const update = (): void => {
      const raw = testInput.value.trim();
      if (!raw) { resultEl.setText(''); return; }
      const basename = raw.replace(/\.md$/i, '');
      const r = rules[ruleIndex] as FilenameRule;

      if (r.mode === 'advanced' && r.matchPattern) {
        if (!testMatch(basename, r.matchPattern)) {
          resultEl.setText('✗ no match');
          resultEl.style.color = 'var(--text-faint)';
          return;
        }
      }

      const hasPattern = r.mode === 'simple' ? !!r.stripFormat : !!r.stripPattern;
      if (!hasPattern) { resultEl.setText('(no pattern set)'); return; }

      const result = applyStrip(basename, r.mode, r.stripFormat, r.stripPattern);
      if (result === basename) {
        resultEl.setText('→ (no change)');
        resultEl.style.color = 'var(--text-faint)';
      } else {
        resultEl.setText(`→ "${result}"`);
        resultEl.style.color = 'var(--color-green)';
      }
    };

    testInput.addEventListener('input', update);
  }
}
