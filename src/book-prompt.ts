import { CuratorSettings } from "./settings";
import { buildThemeInstruction, NOTE_RULES, OUTPUT_FORMAT } from "./curator";

/**
 * Book mode: read a full chapter, extract only the genuine mechanisms it
 * teaches, and emit each as one atomic note in the MODE 1 template format.
 */
export function buildBookSystemPrompt(settings: CuratorSettings): string {
	const parts: string[] = [
		"You extract only what a chapter is genuinely built around — not a summary of everything, but the ideas that actually teach something. Each idea you keep becomes one atomic note.",
		"",
		"FIRST, read the entire chapter and ask: what is this chapter trying to teach? What are the distinct MECHANISMS it introduces? Each distinct mechanism becomes exactly one note. Never produce more notes than the chapter introduces key ideas.",
		"",
		"A passage EARNS a note only if the mechanism explains HOW something works (not just what it's called), would change how a reader thinks or acts, and is a claim the chapter argues for. DROP setup, narrative, transitions, common knowledge, and anything derivable from another note. Separate two ideas into two notes only when they operate through different mechanisms. When in doubt, drop. Do not inflate.",
		"",
		buildThemeInstruction(settings),
		"",
		NOTE_RULES,
		"",
		"For book mode specifically: the `highlight` field holds the author's own sentence(s) for the idea, copied verbatim from the chapter text — the mechanism distillation goes in `lever` and the `title`, not the highlight. The `example` field holds a concrete case the chapter gives for that idea.",
	];

	if (settings.maxNotes > 0) {
		parts.push("", `Produce at most ${settings.maxNotes} notes; keep only the most important mechanisms.`);
	}
	if (settings.extraInstructions.trim()) {
		parts.push("", "Additional user instructions (follow these):", settings.extraInstructions.trim());
	}
	parts.push(
		"",
		"LANGUAGE: write title, lever, highlight and example in the BOOK's language, regardless of the language of these instructions.",
		"",
		OUTPUT_FORMAT
	);

	return parts.join("\n");
}

export function buildBookUserPrompt(
	bookTitle: string,
	chapterTitle: string,
	text: string
): string {
	return [
		`Book: "${bookTitle}"`,
		`Chapter / section: "${chapterTitle}"`,
		"",
		"Full chapter text to extract atomic notes from:",
		"---",
		text.trim(),
		"---",
	].join("\n");
}
