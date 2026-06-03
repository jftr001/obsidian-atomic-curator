import { App, PluginSettingTab, Setting } from "obsidian";
import type AtomicCuratorPlugin from "./main";

export interface CuratorSettings {
	apiKey: string;
	model: string;
	outputFolder: string;
	themes: string;
	addTags: boolean;
	maxNotes: number;
	extraInstructions: string;
}

export const DEFAULT_SETTINGS: CuratorSettings = {
	apiKey: "",
	model: "claude-sonnet-4-6",
	outputFolder: "Atomic Notes",
	themes: "",
	addTags: true,
	maxNotes: 0,
	extraInstructions: "",
};

export const MODELS: Record<string, string> = {
	"claude-haiku-4-5-20251001": "Claude Haiku 4.5 — fastest, cheapest",
	"claude-sonnet-4-6": "Claude Sonnet 4.6 — balanced (recommended)",
	"claude-opus-4-8": "Claude Opus 4.8 — best quality",
};

export class CuratorSettingTab extends PluginSettingTab {
	plugin: AtomicCuratorPlugin;

	constructor(app: App, plugin: AtomicCuratorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Anthropic API key")
			.setDesc(
				"Your own key from console.anthropic.com. Stored locally in this vault, never sent anywhere except Anthropic."
			)
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("sk-ant-...")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Model")
			.setDesc("Which Claude model curates your notes.")
			.addDropdown((dd) => {
				for (const [id, label] of Object.entries(MODELS)) {
					dd.addOption(id, label);
				}
				dd.setValue(this.plugin.settings.model).onChange(async (value) => {
					this.plugin.settings.model = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Output folder")
			.setDesc("Folder where new atomic notes are created (created if missing).")
			.addText((text) =>
				text
					.setPlaceholder("Atomic Notes")
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (value) => {
						this.plugin.settings.outputFolder = value.trim() || "Atomic Notes";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Themes")
			.setDesc(
				"Your themes, one per line. Notes are linked to 1-2 of these by mechanism. Optionally add a description after a dash (e.g. 'Habit — cue, routine, automaticity'). Leave empty to let the model pick free-form themes."
			)
			.addTextArea((ta) => {
				ta.setPlaceholder("Cognition — biases, attention, memory\nHabit — cue, routine, automaticity\nReward — reinforcement, incentives")
					.setValue(this.plugin.settings.themes)
					.onChange(async (value) => {
						this.plugin.settings.themes = value;
						await this.plugin.saveSettings();
					});
				ta.inputEl.rows = 6;
				ta.inputEl.style.width = "100%";
			});

		new Setting(containerEl)
			.setName("Add tags")
			.setDesc("Let the model suggest a few tags per note (in frontmatter).")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.addTags).onChange(async (value) => {
					this.plugin.settings.addTags = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Max notes per run")
			.setDesc("Safety cap on how many atomic notes to extract at once. 0 = no limit.")
			.addText((text) =>
				text
					.setPlaceholder("0")
					.setValue(String(this.plugin.settings.maxNotes))
					.onChange(async (value) => {
						const n = Number.parseInt(value, 10);
						this.plugin.settings.maxNotes = Number.isFinite(n) && n > 0 ? n : 0;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Extra instructions")
			.setDesc(
				"Optional. Custom guidance appended to the curation prompt (e.g. your naming conventions or preferred language)."
			)
			.addTextArea((ta) => {
				ta.setPlaceholder("e.g. Write titles in Spanish. Keep bodies under 60 words.")
					.setValue(this.plugin.settings.extraInstructions)
					.onChange(async (value) => {
						this.plugin.settings.extraInstructions = value;
						await this.plugin.saveSettings();
					});
				ta.inputEl.rows = 4;
				ta.inputEl.style.width = "100%";
			});
	}
}
