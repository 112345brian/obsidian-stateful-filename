import type { App, Setting, SettingDefinitionItem } from 'obsidian';

import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab-base';

import type { FilenameRule } from './PluginSettings.ts';
import type { PluginTypes } from './PluginTypes.ts';

import { applyStrip, testMatch } from './utils.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public override getControlValue(key: string): unknown {
    return (this.plugin.settings as unknown as Record<string, unknown>)[key];
  }

  public override async setControlValue(key: string, value: unknown): Promise<void> {
    (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
    await this.plugin.settingsManager.saveToFile();
    this.update();
  }

  public override getSettingDefinitions(): SettingDefinitionItem[] {
    const lintOnSave = isLinterLintOnSaveActive(this.plugin.app);

    return [
      // ── Rules ──────────────────────────────────────────────────────────
      {
        name: 'Rules',
        desc: 'Evaluated top to bottom; first match wins.',
        render: (setting: Setting): void => { setting.setHeading(); }
      },
      ...this.ruleDefinitions(),
      {
        name: 'Add rule',
        render: (setting: Setting): void => {
          setting.addButton((btn) => {
            btn.setButtonText('Add rule').onClick(() => {
              (this.plugin.settings.rules as FilenameRule[]).push({
                fieldType: 'array',
                matchPattern: '',
                mode: 'simple',
                stripFormat: 'YYYY-MM-DD',
                stripPattern: '',
                targetField: 'aliases'
              });
              void this.plugin.settingsManager.saveToFile();
              this.update();
            });
          });
        }
      },

      // ── Triggers ───────────────────────────────────────────────────────
      {
        name: 'Triggers',
        render: (setting: Setting): void => { setting.setHeading(); }
      },
      {
        control: {
          key: 'triggerOnRename',
          type: 'toggle'
        },
        desc: 'When a note is renamed, find the previous derived value in frontmatter and update it.',
        name: 'Update on rename'
      },
      {
        control: {
          key: 'triggerOnOpen',
          type: 'toggle'
        },
        desc: 'Ensure the derived value exists in frontmatter whenever a note is opened.',
        name: 'Update on file open'
      },
      {
        control: {
          disabled: (): boolean => isLinterLintOnSaveActive(this.plugin.app),
          key: 'triggerOnSave',
          type: 'toggle'
        },
        desc: lintOnSave
          ? 'Disabled — Linter\'s "Lint on save" is active on this vault. Enabling both would cause a save loop.'
          : 'Ensure the derived value exists whenever a note is saved (debounced 2 s).',
        name: 'Update on save'
      },

      // ── Vault scan ─────────────────────────────────────────────────────
      {
        name: 'Vault scan',
        render: (setting: Setting): void => { setting.setHeading(); }
      },
      {
        desc: 'Preview shows every proposed change with individual approve/deny. Run now applies all changes immediately.',
        name: 'Update all notes',
        render: (setting: Setting): void => {
          setting
            .addButton((btn) => {
              btn.setButtonText('Preview changes').onClick(() => {
                this.plugin.openDryRunModal();
              });
            })
            .addButton((btn) => {
              btn.setButtonText('Run now').onClick(() => {
                btn.setDisabled(true);
                btn.setButtonText('Running…');
                void this.plugin.crawlVault().then(({ processed, updated }) => {
                  btn.setButtonText(`Done — ${String(updated)} / ${String(processed)} updated`);
                  window.setTimeout(() => {
                    btn.setDisabled(false);
                    btn.setButtonText('Run now');
                  }, 3000);
                });
              });
            });
        }
      }
    ];
  }

  /**
   * One block of definitions per rule: a header row (mode + reorder/delete), a
   * mode-dependent pattern row, a write-target row, and a live sandbox row.
   * Flattened into the main definitions list.
   *
   * Rules are a dynamic, user-editable, reorderable list of multi-field forms,
   * which doesn't map onto the declarative API's `list` control (built for
   * flat, add-only collections). So each rule is rendered with `render`
   * callbacks instead, the same way the reference migrations render
   * multi-field dynamic groups.
   */
  private ruleDefinitions(): SettingDefinitionItem[] {
    const rules = this.plugin.settings.rules as FilenameRule[];

    if (rules.length === 0) {
      return [{
        desc: 'No rules defined.',
        name: '',
        render: (): void => { /* empty state, no controls */ }
      }];
    }

    return rules.flatMap((rule, i): SettingDefinitionItem[] => [
      // ── Row 1: header + mode toggle + reorder/delete ──────────────────
      {
        name: `Rule ${String(i + 1)}`,
        render: (setting: Setting): void => {
          setting
            .addDropdown((dd) => {
              dd.addOption('simple', 'Simple (date format)')
                .addOption('advanced', 'Advanced (regex)')
                .setValue(rule.mode)
                .onChange((value) => {
                  (rules[i] as FilenameRule).mode = value as 'simple' | 'advanced';
                  void this.plugin.settingsManager.saveToFile();
                  this.update();
                });
            })
            .addExtraButton((btn) => {
              btn.setIcon('arrow-up').setTooltip('Move up').onClick(() => {
                if (i === 0) return;
                [rules[i - 1], rules[i]] = [rules[i] as FilenameRule, rules[i - 1] as FilenameRule];
                void this.plugin.settingsManager.saveToFile();
                this.update();
              });
            })
            .addExtraButton((btn) => {
              btn.setIcon('arrow-down').setTooltip('Move down').onClick(() => {
                if (i === rules.length - 1) return;
                [rules[i], rules[i + 1]] = [rules[i + 1] as FilenameRule, rules[i] as FilenameRule];
                void this.plugin.settingsManager.saveToFile();
                this.update();
              });
            })
            .addExtraButton((btn) => {
              btn.setIcon('trash').setTooltip('Delete').onClick(() => {
                rules.splice(i, 1);
                void this.plugin.settingsManager.saveToFile();
                this.update();
              });
            });
        }
      },

      // ── Row 2: pattern inputs (mode-dependent) ─────────────────────────
      rule.mode === 'simple'
        ? {
          desc: 'Moment.js format of the date prefix to strip (e.g. YYYY-MM-DD, YYYYMMDDHHmm).',
          name: 'Date format',
          render: (setting: Setting): void => {
            setting.addMomentFormat((mf) => {
              mf.setPlaceholder('YYYY-MM-DD')
                .setValue(rule.stripFormat)
                .onChange((value) => {
                  (rules[i] as FilenameRule).stripFormat = value;
                });
              mf.inputEl.addEventListener('blur', () => { void this.plugin.settingsManager.saveToFile(); });
            });
          }
        }
        : {
          desc: 'Match: regex the filename must satisfy (empty = all files). Strip: regex removed from the filename.',
          name: 'Match & strip',
          render: (setting: Setting): void => {
            setting
              .addText((text) => {
                text.setPlaceholder('Match (empty = all)')
                  .setValue(rule.matchPattern)
                  .onChange((value) => {
                    (rules[i] as FilenameRule).matchPattern = value;
                  });
                text.inputEl.style.width = '13em';
                text.inputEl.addEventListener('blur', () => { void this.plugin.settingsManager.saveToFile(); });
              })
              .addText((text) => {
                text.setPlaceholder('Strip regex')
                  .setValue(rule.stripPattern)
                  .onChange((value) => {
                    (rules[i] as FilenameRule).stripPattern = value;
                  });
                text.inputEl.style.width = '13em';
                text.inputEl.addEventListener('blur', () => { void this.plugin.settingsManager.saveToFile(); });
              });
          }
        },

      // ── Row 3: write target ─────────────────────────────────────────────
      {
        desc: 'Write result to:',
        name: '',
        render: (setting: Setting): void => {
          setting
            .addText((text) => {
              text.setPlaceholder('frontmatter key (e.g. aliases, title)')
                .setValue(rule.targetField)
                .onChange((value) => {
                  (rules[i] as FilenameRule).targetField = value;
                });
              text.inputEl.style.width = '13em';
              text.inputEl.addEventListener('blur', () => { void this.plugin.settingsManager.saveToFile(); });
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
        }
      },

      // ── Row 4: live sandbox ──────────────────────────────────────────────
      {
        desc: 'Test:',
        name: '',
        render: (setting: Setting): void => {
          const testInput = setting.controlEl.createEl('input', { type: 'text' });
          testInput.placeholder = 'Type a filename to preview…';
          testInput.style.cssText = 'width:16em; margin-right:0.5em;';

          const resultEl = setting.controlEl.createEl('span');
          resultEl.style.cssText = 'opacity:0.7; font-style:italic;';

          const update = (): void => {
            const raw = testInput.value.trim();
            if (!raw) { resultEl.setText(''); return; }
            const basename = raw.replace(/\.md$/i, '');
            const r = rules[i] as FilenameRule;

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
    ]);
  }
}

function isLinterLintOnSaveActive(app: App): boolean {
  const plugins = (app as unknown as { plugins?: { plugins?: Record<string, { settings?: { lintOnSave?: boolean } }> } }).plugins;
  return plugins?.plugins?.['obsidian-linter']?.settings?.lintOnSave === true;
}
