import { Notice, Plugin, TFile, TFolder, normalizePath } from "obsidian";
import { CuratorSettings, DEFAULT_SETTINGS, CuratorSettingTab } from "./settings";
import { callAnthropic } from "./anthropic";
import {
	AtomicNote,
	buildSystemPrompt,
	buildUserPrompt,
	parseAtomicNotes,
} from "./curator";
import { PreviewModal } from "./preview-modal";
import { buildBookSystemPrompt, buildBookUserPrompt } from "./book-prompt";
import { BookModal, ExtractedChapter } from "./book-modal";

const BOOK_MAX_TOKENS = 8192;

export default class AtomicCuratorPlugin extends Plugin {
	settings!: CuratorSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("atom", "Curate into atomic notes", () => {
			void this.curateActiveNote();
		});

		this.addCommand({
			id: "curate-active-note",
			name: "Curate active note into atomic notes",
			callback: () => void this.curateActiveNote(),
		});

		this.addCommand({
			id: "curate-from-book",
			name: "Curate from book (PDF/EPUB)",
			callback: () => void this.curateFromBook(),
		});

		this.addSettingTab(new CuratorSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async curateActiveNote(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			new Notice("Open a markdown note first.");
			return;
		}

		if (!this.settings.apiKey) {
			new Notice("Add your Anthropic API key in Atomic Curator settings.");
			return;
		}

		const content = (await this.app.vault.read(file)).trim();
		if (content.length < 20) {
			new Notice("This note is too short to curate.");
			return;
		}

		const notice = new Notice("Atomic Curator: curating…", 0);
		let notes: AtomicNote[];
		try {
			const system = buildSystemPrompt(this.settings);
			const user = buildUserPrompt(file.basename, content);
			const raw = await callAnthropic(this.settings, system, user);
			notes = parseAtomicNotes(raw);
		} catch (e) {
			notice.hide();
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(`Atomic Curator: ${msg}`, 8000);
			return;
		}
		notice.hide();

		if (notes.length === 0) {
			new Notice("Atomic Curator: no atomic notes found in this note.");
			return;
		}

		new PreviewModal(this.app, notes, file.basename, (chosen) => {
			void this.createNotes(chosen, file.basename);
		}).open();
	}

	private async curateFromBook(): Promise<void> {
		if (!this.settings.apiKey) {
			new Notice("Add your Anthropic API key in Atomic Curator settings.");
			return;
		}
		const books = this.app.vault.getFiles().filter((f) => {
			const ext = f.extension.toLowerCase();
			return ext === "pdf" || ext === "epub";
		});
		new BookModal(this.app, books, (chapter) =>
			void this.runBookCuration(chapter)
		).open();
	}

	private async runBookCuration(chapter: ExtractedChapter): Promise<void> {
		const notice = new Notice("Atomic Curator: curating chapter…", 0);
		let notes: AtomicNote[];
		try {
			const system = buildBookSystemPrompt(this.settings);
			const user = buildBookUserPrompt(
				chapter.bookTitle,
				chapter.chapterTitle,
				chapter.text
			);
			const raw = await callAnthropic(this.settings, system, user, BOOK_MAX_TOKENS);
			notes = parseAtomicNotes(raw);
		} catch (e) {
			notice.hide();
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(`Atomic Curator: ${msg}`, 8000);
			return;
		}
		notice.hide();

		if (notes.length === 0) {
			new Notice("Atomic Curator: no atomic notes found in this chapter.");
			return;
		}

		const label = `${chapter.bookTitle} — ${chapter.chapterTitle}`;
		new PreviewModal(this.app, notes, label, (chosen) => {
			void this.createNotes(chosen, chapter.bookTitle);
		}).open();
	}

	private async createNotes(notes: AtomicNote[], sourceName: string): Promise<void> {
		if (notes.length === 0) return;

		const folder = this.settings.outputFolder.trim() || "Atomic Notes";
		await this.ensureFolder(folder);

		let created = 0;
		const failures: string[] = [];
		for (const note of notes) {
			try {
				const path = await this.uniquePath(folder, note.title);
				await this.app.vault.create(path, this.renderNote(note, sourceName));
				created++;
			} catch (e) {
				failures.push(note.title);
			}
		}

		if (created > 0) {
			new Notice(
				`Atomic Curator: created ${created} note${created === 1 ? "" : "s"} in "${folder}".`
			);
		}
		if (failures.length > 0) {
			new Notice(`Atomic Curator: ${failures.length} note(s) could not be created.`, 6000);
		}
	}

	private renderNote(note: AtomicNote, sourceName: string): string {
		const parts: string[] = [];
		if (this.settings.addTags && note.tags.length > 0) {
			parts.push("---");
			parts.push("tags:");
			for (const tag of note.tags) parts.push(`  - ${tag}`);
			parts.push("---");
			parts.push("");
		}
		parts.push(`# ${note.title}`);
		parts.push("");
		parts.push(note.body);
		if (this.settings.linkBackToSource) {
			parts.push("");
			parts.push("---");
			parts.push(`Source: [[${sourceName}]]`);
		}
		parts.push("");
		return parts.join("\n");
	}

	private async ensureFolder(folder: string): Promise<void> {
		const path = normalizePath(folder);
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFolder) return;
		if (existing) throw new Error(`"${folder}" exists but is not a folder.`);
		await this.app.vault.createFolder(path);
	}

	private async uniquePath(folder: string, title: string): Promise<string> {
		const base = sanitizeFilename(title) || "Untitled note";
		let candidate = normalizePath(`${folder}/${base}.md`);
		let i = 2;
		while (this.app.vault.getAbstractFileByPath(candidate)) {
			candidate = normalizePath(`${folder}/${base} ${i}.md`);
			i++;
		}
		return candidate;
	}
}

function sanitizeFilename(title: string): string {
	return title
		.replace(/[\\/:*?"<>|#^[\]]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 100)
		.replace(/[.\s]+$/, "");
}
