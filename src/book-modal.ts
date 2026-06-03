import { App, Modal, Notice, Setting, TFile } from "obsidian";
import { loadPdf, extractPdfRange, LoadedPdf } from "./extract/pdf";
import { extractEpub, EpubChapter, XmlParser } from "./extract/epub";

export interface ExtractedChapter {
	bookTitle: string;
	chapterTitle: string;
	text: string;
}

/**
 * Lets the user pick a PDF/EPUB in the vault, choose a chapter (EPUB) or page
 * range (PDF), and extracts the chapter text, handing it back via onExtracted.
 */
export class BookModal extends Modal {
	private files: TFile[];
	private onExtracted: (c: ExtractedChapter) => void;

	private selected: TFile | null = null;
	private kind: "pdf" | "epub" | null = null;
	private pdf: LoadedPdf | null = null;
	private numPages = 0;
	private fromPage = 1;
	private toPage = 1;
	private chapters: EpubChapter[] = [];
	private chapterIndex = 0;

	private detailEl!: HTMLElement;

	constructor(app: App, files: TFile[], onExtracted: (c: ExtractedChapter) => void) {
		super(app);
		this.files = files;
		this.onExtracted = onExtracted;
		this.selected = files[0] ?? null;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("atomic-curator-modal");
		contentEl.empty();
		contentEl.createEl("h2", { text: "Curate from a book" });

		if (this.files.length === 0) {
			contentEl.createEl("p", {
				cls: "ac-summary",
				text: "No PDF or EPUB files found in this vault. Add a book file and try again.",
			});
			return;
		}

		new Setting(contentEl)
			.setName("Book file")
			.setDesc("A PDF or EPUB in your vault.")
			.addDropdown((dd) => {
				for (const f of this.files) dd.addOption(f.path, f.path);
				dd.setValue(this.selected?.path ?? "");
				dd.onChange((path) => {
					this.selected = this.files.find((f) => f.path === path) ?? null;
					this.resetLoaded();
					this.renderDetail();
				});
			})
			.addButton((btn) =>
				btn
					.setButtonText("Load")
					.setCta()
					.onClick(() => void this.loadSelected())
			);

		this.detailEl = contentEl.createDiv();
		this.renderDetail();
	}

	private resetLoaded(): void {
		this.kind = null;
		void this.pdf?.destroy();
		this.pdf = null;
		this.chapters = [];
		this.numPages = 0;
		this.chapterIndex = 0;
	}

	private async loadSelected(): Promise<void> {
		if (!this.selected) return;
		const ext = this.selected.extension.toLowerCase();
		if (ext !== "pdf" && ext !== "epub") {
			new Notice("Unsupported file type. Pick a PDF or EPUB.");
			return;
		}

		const notice = new Notice("Loading book…", 0);
		try {
			const data = await this.app.vault.readBinary(this.selected);
			if (ext === "pdf") {
				this.pdf = await loadPdf(data);
				this.numPages = this.pdf.doc.numPages;
				this.fromPage = 1;
				this.toPage = Math.min(this.numPages, 30);
				this.kind = "pdf";
			} else {
				this.chapters = await extractEpub(data, new DOMParser() as unknown as XmlParser);
				this.chapterIndex = 0;
				this.kind = "epub";
			}
		} catch (e) {
			notice.hide();
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(`Could not read the book: ${msg}`, 8000);
			return;
		}
		notice.hide();
		this.renderDetail();
	}

	private renderDetail(): void {
		if (!this.detailEl) return;
		this.detailEl.empty();

		if (this.kind === "pdf") {
			this.detailEl.createEl("p", {
				cls: "ac-summary",
				text: `PDF loaded — ${this.numPages} pages. Choose a page range (a single chapter works best).`,
			});
			new Setting(this.detailEl).setName("From page").addText((t) => {
				t.setValue(String(this.fromPage)).onChange((v) => {
					this.fromPage = clampInt(v, 1, this.numPages, this.fromPage);
				});
			});
			new Setting(this.detailEl).setName("To page").addText((t) => {
				t.setValue(String(this.toPage)).onChange((v) => {
					this.toPage = clampInt(v, 1, this.numPages, this.toPage);
				});
			});
			this.addExtractButton();
		} else if (this.kind === "epub") {
			this.detailEl.createEl("p", {
				cls: "ac-summary",
				text: `EPUB loaded — ${this.chapters.length} sections. Choose the chapter to curate.`,
			});
			new Setting(this.detailEl).setName("Chapter").addDropdown((dd) => {
				this.chapters.forEach((c) =>
					dd.addOption(String(c.index), `${c.index}. ${truncate(c.title, 60)}`)
				);
				dd.setValue(String(this.chapters[this.chapterIndex]?.index ?? 1));
				dd.onChange((v) => {
					const idx = this.chapters.findIndex((c) => String(c.index) === v);
					if (idx >= 0) this.chapterIndex = idx;
				});
			});
			this.addExtractButton();
		} else {
			this.detailEl.createEl("p", {
				cls: "ac-summary",
				text: "Click Load to read the file, then choose what to curate.",
			});
		}
	}

	private addExtractButton(): void {
		new Setting(this.detailEl).addButton((btn) =>
			btn
				.setCta()
				.setButtonText("Extract & curate")
				.onClick(() => void this.extract())
		);
	}

	private async extract(): Promise<void> {
		if (!this.selected) return;
		const bookTitle = this.selected.basename;

		if (this.kind === "pdf" && this.pdf) {
			if (this.toPage < this.fromPage) {
				new Notice("'To page' must be greater than or equal to 'From page'.");
				return;
			}
			const notice = new Notice("Extracting text from PDF…", 0);
			let text: string;
			try {
				text = await extractPdfRange(this.pdf.doc, this.fromPage, this.toPage);
			} catch (e) {
				notice.hide();
				new Notice(`PDF extraction failed: ${e instanceof Error ? e.message : e}`, 8000);
				return;
			}
			notice.hide();
			if (text.trim().length < 40) {
				new Notice("No selectable text in that range. This may be a scanned PDF.", 8000);
				return;
			}
			this.close();
			this.onExtracted({
				bookTitle,
				chapterTitle: `pages ${this.fromPage}–${this.toPage}`,
				text,
			});
			return;
		}

		if (this.kind === "epub") {
			const chapter = this.chapters[this.chapterIndex];
			if (!chapter) return;
			this.close();
			this.onExtracted({
				bookTitle,
				chapterTitle: chapter.title,
				text: chapter.text,
			});
		}
	}

	onClose(): void {
		void this.pdf?.destroy();
		this.contentEl.empty();
	}
}

function clampInt(value: string, min: number, max: number, fallback: number): number {
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}

function truncate(s: string, max: number): string {
	const clean = s.replace(/\s+/g, " ").trim();
	return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}
