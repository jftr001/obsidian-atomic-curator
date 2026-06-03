import { CuratorSettings } from "./settings";

/**
 * The Book Highlights Extractor methodology, encoded as a system prompt.
 * It reads a full chapter and extracts only the genuine *mechanisms* it teaches,
 * emitting each as one atomic note (title + body + tags) so the result flows
 * through the same preview-and-create pipeline as the highlight curator.
 */
export function buildBookSystemPrompt(settings: CuratorSettings): string {
	const lines: string[] = [
		"You extract only what a chapter is genuinely built around — not a summary of everything, but the ideas that actually teach something. Each idea you keep becomes one atomic note.",
		"",
		"FIRST, read the entire chapter and ask yourself: what is this chapter trying to teach? What are the distinct MECHANISMS it introduces? Each distinct mechanism becomes exactly one note. That count is your ceiling — never produce more notes than the chapter introduces key ideas.",
		"",
		"A passage EARNS a note only if the mechanism:",
		"- Explains HOW something works — not just what it is called.",
		"- Would change how a reader thinks or acts if internalized.",
		"- Is a claim the chapter argues for and builds toward.",
		"",
		"DROP silently if it is: setup or narrative that only introduces the real idea; a repeat of a mechanism already captured; common knowledge, a rhetorical question, or a transition; or derivable from another note without adding anything new. When in doubt, drop. Do not inflate.",
		"",
		"Separate two ideas into two notes when they share a goal but operate through different mechanisms (each explains a different 'how'). Do NOT merge ideas just because they share a topic or a named concept.",
		"",
		"EACH NOTE HAS:",
		"",
		"title — a single declarative sentence of about 6 to 12 words, containing a verb, that states the mechanism (the claim), not a topic. Good: 'Spaced repetition beats massed practice for long-term retention.' Bad: 'Spaced repetition' or 'Notes on memory.'",
		"",
		"body — the mechanism explained as a direct, self-contained claim, followed by a concrete illustration. The mechanism explanation must pass three tests:",
		"  1. Name-removal: if you delete the concept's name, the explanation still stands on its own. Explain what actually happens, don't lean on the label.",
		"  2. Because: it must contain the causal reason the mechanism works. If a reader can ask 'but why does that happen?' and the body doesn't answer, it is incomplete.",
		"  3. Effect-first: state WHAT the mechanism produces before explaining WHY. Never open with 'X works because Y'.",
		"After the mechanism, add the concrete illustration from the book on its own line, beginning with 'Example: ' — a specific story, experiment, or case with enough detail to see the mechanism in action (who, the situation, the intervention, the outcome). If the chapter offers no concrete case for that idea, omit the example rather than inventing one.",
		"Prefer the author's own strong sentence as an anchor when one exists, quoted, then extended in your words with what the surrounding text says — never invent claims the text does not support.",
	];

	if (settings.addTags) {
		lines.push("", "tags — 1 to 4 short lowercase kebab-case tags per note (concepts, not generic words).");
	} else {
		lines.push("", "tags — return an empty array for every note.");
	}

	lines.push(
		"",
		"LANGUAGE: write every title and body in the BOOK's language, regardless of the language of these instructions. If the chapter text is in English, write in English; if in Spanish, write in Spanish.",
	);

	if (settings.maxNotes > 0) {
		lines.push(
			"",
			`Produce at most ${settings.maxNotes} notes; if the chapter teaches more, keep only the most important mechanisms.`
		);
	}

	if (settings.extraInstructions.trim()) {
		lines.push("", "Additional user instructions (follow these):", settings.extraInstructions.trim());
	}

	lines.push(
		"",
		"OUTPUT FORMAT — read carefully:",
		"Return ONLY a JSON array, with no prose before or after and no markdown code fences.",
		'Each element is an object: {"title": string, "body": string, "tags": string[]}.',
		"Use \\n inside body to separate the mechanism from the 'Example:' line.",
		"If the chapter teaches nothing worth keeping, return an empty array: []",
	);

	return lines.join("\n");
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
