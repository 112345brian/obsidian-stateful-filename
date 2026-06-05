import type { App } from 'obsidian';

import { Modal } from 'obsidian';

import type { ProposedChange } from './Plugin.ts';

export class VaultScanModal extends Modal {
  private readonly changes: ProposedChange[];
  private readonly approved: Set<number>;
  private readonly onApply: (approved: ProposedChange[]) => Promise<void>;

  public constructor(
    app: App,
    changes: ProposedChange[],
    onApply: (approved: ProposedChange[]) => Promise<void>
  ) {
    super(app);
    this.changes = changes;
    this.onApply = onApply;
    // All changes approved by default.
    this.approved = new Set(changes.map((_, i) => i));
  }

  public override onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.modalEl.style.width = 'min(700px, 90vw)';

    contentEl.createEl('h2', { text: `Vault scan — ${String(this.changes.length)} proposed changes` });

    // ── Toolbar ──────────────────────────────────────────────────────────────
    const toolbar = contentEl.createDiv();
    toolbar.style.cssText = 'display:flex; gap:0.5em; margin-bottom:0.75em; align-items:center;';

    const selectAll = toolbar.createEl('button', { text: 'Select all' });
    const deselectAll = toolbar.createEl('button', { text: 'Deselect all' });
    const countEl = toolbar.createEl('span');
    countEl.style.cssText = 'margin-left:auto; opacity:0.6; font-size:0.85em;';

    // ── Change list ───────────────────────────────────────────────────────────
    const listEl = contentEl.createDiv();
    listEl.style.cssText = [
      'max-height:50vh',
      'overflow-y:auto',
      'border:1px solid var(--background-modifier-border)',
      'border-radius:6px',
      'padding:0.25em 0'
    ].join(';');

    const checkboxes: HTMLInputElement[] = [];

    const updateCount = (): void => {
      countEl.setText(`${String(this.approved.size)} of ${String(this.changes.length)} selected`);
    };

    for (const [i, change] of this.changes.entries()) {
      const row = listEl.createDiv();
      row.style.cssText = [
        'display:flex',
        'align-items:flex-start',
        'gap:0.6em',
        'padding:0.5em 0.75em',
        'border-bottom:1px solid var(--background-modifier-border)',
        'cursor:pointer'
      ].join(';');
      row.style.setProperty('transition', 'background 0.1s');

      const checkbox = row.createEl('input', { type: 'checkbox' });
      checkbox.checked = true;
      checkbox.style.cssText = 'margin-top:3px; flex-shrink:0; cursor:pointer;';
      checkboxes.push(checkbox);

      const info = row.createDiv();
      info.style.cssText = 'flex:1; min-width:0;';

      // File path
      const pathEl = info.createEl('div');
      pathEl.style.cssText = 'font-size:0.85em; opacity:0.7; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
      pathEl.setText(change.file.path);

      // Change description
      const descEl = info.createEl('div');
      descEl.style.cssText = 'font-size:0.9em; margin-top:2px;';
      descEl.setText(formatChange(change));

      // Clicking the row toggles the checkbox
      row.addEventListener('click', (e) => {
        if (e.target === checkbox) return;
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      });

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.approved.add(i);
          row.style.opacity = '1';
        } else {
          this.approved.delete(i);
          row.style.opacity = '0.45';
        }
        updateCount();
      });
    }

    updateCount();

    selectAll.addEventListener('click', () => {
      for (const [i, cb] of checkboxes.entries()) {
        cb.checked = true;
        this.approved.add(i);
        (cb.closest('div[style]') as HTMLElement | null)?.style.setProperty('opacity', '1');
      }
      updateCount();
    });

    deselectAll.addEventListener('click', () => {
      for (const [i, cb] of checkboxes.entries()) {
        cb.checked = false;
        this.approved.delete(i);
        (cb.closest('div[style]') as HTMLElement | null)?.style.setProperty('opacity', '0.45');
      }
      updateCount();
    });

    // ── Footer ────────────────────────────────────────────────────────────────
    const footer = contentEl.createDiv();
    footer.style.cssText = 'display:flex; justify-content:flex-end; gap:0.5em; margin-top:1em;';

    const cancelBtn = footer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => { this.close(); });

    const applyBtn = footer.createEl('button', { text: 'Apply selected', cls: 'mod-cta' });
    applyBtn.addEventListener('click', () => {
      applyBtn.disabled = true;
      applyBtn.textContent = 'Applying…';
      const toApply = this.changes.filter((_, i) => this.approved.has(i));
      void this.onApply(toApply).then(() => { this.close(); });
    });
  }

  public override onClose(): void {
    this.contentEl.empty();
  }
}

function formatChange(change: ProposedChange): string {
  const { targetField, fieldType, cleanValue, currentValues } = change;
  if (fieldType === 'array') {
    if (currentValues.length > 0) {
      return `${targetField}: [${currentValues.join(', ')}] → add "${cleanValue}"`;
    }
    return `${targetField}: add "${cleanValue}"`;
  }
  if (currentValues.length > 0) {
    return `${targetField}: "${currentValues[0]}" → "${cleanValue}"`;
  }
  return `${targetField}: → "${cleanValue}"`;
}
