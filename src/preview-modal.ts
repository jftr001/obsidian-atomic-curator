import { App, Modal, Setting } from "obsidian";
import { AtomicNote } from "./curator";

/**
 * Shows the proposed atomic notes with checkboxes so the user can
 * review and pick which ones to actually create.
 */
export class PreviewModal extends Modal {
	private notes: AtomicNote[];
	private selected: boolean[];
	private sourceName: string;
	private onConfirm: (chosen: AtomicNote[]) => void;

	constructor(
		app: App,
		notes: AtomicNote[],
		sourceName: string,
		onConfirm: (chosen: AtomicNote[]) => void
	) {
		super(app);
		this.notes = notes;
		this.selected = notes.map(() => true);
		this.sourceName = sourceName;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("atomic-curator-modal");
		contentEl.empty();

		contentEl.createEl("h2", { text: "Review atomic notes" });
		const summary = contentEl.createEl("p", { cls: "ac-summary" });
		summary.setText(
			`${this.notes.length} atomic note${this.notes.length === 1 ? "" : "s"} extracted from "${this.sourceName}". Uncheck any you don't want.`
		);

		const list = contentEl.createDiv({ cls: "atomic-curator-list" });
		this.notes.forEach((note, i) => {
			const item = list.createDiv({ cls: "atomic-curator-item" });

			const checkbox = item.createEl("input", { type: "checkbox" });
			checkbox.checked = this.selected[i];
			checkbox.addEventListener("change", () => {
				this.selected[i] = checkbox.checked;
				this.updateCreateLabel();
			});

			const bodyWrap = item.createDiv({ cls: "atomic-curator-item-body" });
			bodyWrap.createDiv({ cls: "atomic-curator-item-title", text: note.title });
			bodyWrap.createDiv({
				cls: "atomic-curator-item-preview",
				text: truncate(note.body, 240),
			});
			if (note.tags.length) {
				const tagsWrap = bodyWrap.createDiv({ cls: "atomic-curator-item-tags" });
				note.tags.forEach((t) =>
					tagsWrap.createSpan({ cls: "atomic-curator-tag", text: `#${t}` })
				);
			}
		});

		const actions = contentEl.createDiv({ cls: "atomic-curator-actions" });
		const toggle = actions.createSpan({
			cls: "ac-select-toggle",
			text: "Select / deselect all",
		});
		toggle.addEventListener("click", () => {
			const allSelected = this.selected.every(Boolean);
			this.selected = this.selected.map(() => !allSelected);
			this.onOpen(); // re-render
		});

		const buttonRow = actions.createDiv();
		new Setting(buttonRow)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close())
			)
			.addButton((btn) => {
				this.createBtn = btn.buttonEl;
				btn
					.setCta()
					.setButtonText("Create notes")
					.onClick(() => {
						const chosen = this.notes.filter((_, i) => this.selected[i]);
						this.close();
						this.onConfirm(chosen);
					});
				this.updateCreateLabel();
			});
	}

	private createBtn: HTMLElement | null = null;

	private updateCreateLabel(): void {
		if (!this.createBtn) return;
		const count = this.selected.filter(Boolean).length;
		this.createBtn.setText(`Create ${count} note${count === 1 ? "" : "s"}`);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

function truncate(text: string, max: number): string {
	const clean = text.replace(/\s+/g, " ").trim();
	return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}
