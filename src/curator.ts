import { CuratorSettings } from "./settings";

export interface AtomicNote {
	title: string;
	body: string;
	tags: string[];
}

/**
 * The curation methodology, encoded as a system prompt.
 * This is the heart of the plugin: it turns messy input into atomic notes
 * following Zettelkasten principles, rather than just summarising.
 */
export function buildSystemPrompt(settings: CuratorSettings): string {
	const lines: string[] = [
		"You are an expert Zettelkasten curator. You turn raw, messy notes and book highlights into clean ATOMIC notes.",
		"",
		"What an atomic note is:",
		"- It contains exactly ONE idea. If a passage holds three ideas, produce three notes.",
		"- It is SELF-CONTAINED: understandable on its own, without the surrounding context.",
		"- Its TITLE is a full declarative sentence stating the idea or claim — not a topic or a noun phrase.",
		'  Good: "Spaced repetition beats massed practice for long-term retention."',
		'  Bad: "Spaced repetition" or "Notes on memory".',
		"- The BODY is rewritten in clear, concise prose IN YOUR OWN WORDS. Do not copy the source verbatim.",
		"- Keep the body tight: usually 2-5 sentences. Explain the idea, not the source.",
		"",
		"What to do:",
		"- Extract the durable ideas worth keeping. Merge duplicates and near-duplicates into one note.",
		"- Drop filler, pleasantries, page numbers, and anything that is not a reusable idea.",
		"- Preserve concrete facts, mechanisms, and reasoning. Do not invent claims not supported by the input.",
		"- If the input contains a direct quote worth keeping, you may include it inside the body, attributed, but still lead with the idea in your own words.",
	];

	if (settings.addTags) {
		lines.push(
			"- Suggest 1-4 short, lowercase, kebab-case tags per note (concepts, not generic words like 'note')."
		);
	} else {
		lines.push("- Return an empty tags array for every note.");
	}

	if (settings.maxNotes > 0) {
		lines.push(
			`- Produce at most ${settings.maxNotes} notes. Keep only the most important ideas if the input has more.`
		);
	}

	if (settings.extraInstructions.trim()) {
		lines.push("", "Additional user instructions (follow these):", settings.extraInstructions.trim());
	}

	lines.push(
		"",
		"OUTPUT FORMAT — read carefully:",
		"Return ONLY a JSON array, with no prose before or after, no markdown code fences.",
		'Each element is an object: {"title": string, "body": string, "tags": string[]}.',
		"If the input contains no ideas worth keeping, return an empty array: []",
	);

	return lines.join("\n");
}

export function buildUserPrompt(noteName: string, content: string): string {
	return [
		`Source note: "${noteName}"`,
		"",
		"Raw content to curate into atomic notes:",
		"---",
		content.trim(),
		"---",
	].join("\n");
}

/**
 * Robustly parse the model's response into atomic notes.
 * Tolerates stray prose, markdown code fences, and trailing commentary.
 */
export function parseAtomicNotes(raw: string): AtomicNote[] {
	const text = stripCodeFences(raw).trim();
	const jsonSlice = extractJsonArray(text);
	if (!jsonSlice) {
		throw new Error("The model did not return a JSON array.");
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonSlice);
	} catch (e) {
		throw new Error("Could not parse the model's response as JSON.");
	}

	if (!Array.isArray(parsed)) {
		throw new Error("Expected a JSON array of notes.");
	}

	const notes: AtomicNote[] = [];
	for (const item of parsed) {
		if (!item || typeof item !== "object") continue;
		const obj = item as Record<string, unknown>;
		const title = typeof obj.title === "string" ? obj.title.trim() : "";
		const body = typeof obj.body === "string" ? obj.body.trim() : "";
		if (!title || !body) continue;
		const tags = Array.isArray(obj.tags)
			? obj.tags
					.filter((t): t is string => typeof t === "string")
					.map((t) => normaliseTag(t))
					.filter((t) => t.length > 0)
			: [];
		notes.push({ title, body, tags });
	}
	return notes;
}

function stripCodeFences(text: string): string {
	const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	return fenceMatch ? fenceMatch[1] : text;
}

function extractJsonArray(text: string): string | null {
	const start = text.indexOf("[");
	const end = text.lastIndexOf("]");
	if (start === -1 || end === -1 || end < start) return null;
	return text.slice(start, end + 1);
}

function normaliseTag(tag: string): string {
	return tag
		.trim()
		.replace(/^#/, "")
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9\-_/]/g, "");
}
