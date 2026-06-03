import { CuratorSettings } from "./settings";

/** One atomic note, matching the MODE 1 on-disk template. */
export interface AtomicNote {
	title: string; // mechanism-based, 6-12 words, becomes the filename
	lever: string; // mechanism phrase, 5-12 words
	themes: string[]; // 1-2 theme names (from the user's theme list when configured)
	highlight: string; // verbatim source idea (page markers stripped)
	example?: string; // concrete case from the source, if any
	page?: string; // page number if the source shows one
}

// --- slug + filename helpers (exported, reused by main.ts) ---

export function slugify(input: string): string {
	return input
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "") // strip diacritics
		.toLowerCase()
		.trim()
		.replace(/[\s_]+/g, "-")
		.replace(/[^a-z0-9/-]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

const FORBIDDEN_SUBSTITUTIONS: Array<[RegExp, string]> = [
	[/:/g, " —"],
	[/"/g, "'"],
	[/\//g, " and "],
	[/\\/g, " and "],
	[/\|/g, " and "],
	[/</g, " less than "],
	[/>/g, " greater than "],
	[/\?/g, ""],
	[/\*/g, ""],
];

/** Make a mechanism title safe as a Windows filename, preserving meaning. */
export function sanitizeTitle(title: string): string {
	let t = title;
	for (const [re, sub] of FORBIDDEN_SUBSTITUTIONS) t = t.replace(re, sub);
	t = t.replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
	return t.slice(0, 150).trim() || "Untitled note";
}

// --- response parsing ---

export function parseAtomicNotes(raw: string): AtomicNote[] {
	const text = stripCodeFences(raw).trim();
	const jsonSlice = extractJsonArray(text);
	if (!jsonSlice) throw new Error("The model did not return a JSON array.");

	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonSlice);
	} catch (e) {
		throw new Error("Could not parse the model's response as JSON.");
	}
	if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of notes.");

	const notes: AtomicNote[] = [];
	for (const item of parsed) {
		if (!item || typeof item !== "object") continue;
		const obj = item as Record<string, unknown>;
		const title = str(obj.title);
		const highlight = str(obj.highlight);
		if (!title || !highlight) continue;
		const themes = Array.isArray(obj.themes)
			? obj.themes.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean).slice(0, 2)
			: [];
		notes.push({
			title,
			lever: str(obj.lever),
			themes,
			highlight,
			example: str(obj.example) || undefined,
			page: str(obj.page) || undefined,
		});
	}
	return notes;
}

function str(v: unknown): string {
	return typeof v === "string" ? v.trim() : "";
}

function stripCodeFences(text: string): string {
	const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	return fence ? fence[1] : text;
}

function extractJsonArray(text: string): string | null {
	const start = text.indexOf("[");
	const end = text.lastIndexOf("]");
	if (start === -1 || end === -1 || end < start) return null;
	return text.slice(start, end + 1);
}

// --- shared prompt fragments (used by both highlight and book modes) ---

interface ThemeEntry {
	name: string;
	desc: string;
}

function parseThemes(raw: string): ThemeEntry[] {
	return raw
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const m = line.match(/^(.*?)\s*(?:—|:|\s-\s)\s*(.+)$/);
			if (m) return { name: m[1].trim(), desc: m[2].trim() };
			return { name: line, desc: "" };
		})
		.filter((t) => t.name.length > 0);
}

export function buildThemeInstruction(settings: CuratorSettings): string {
	const themes = parseThemes(settings.themes);
	if (themes.length === 0) {
		return [
			"themes: assign 1-2 short theme names (1-3 words each) that capture the note's core MECHANISM (the primary lever), not a keyword it merely mentions. The first theme is primary and must genuinely fit; add a second only if the note substantively contributes to it.",
		].join("\n");
	}
	const list = themes
		.map((t) => (t.desc ? `- ${t.name}: ${t.desc}` : `- ${t.name}`))
		.join("\n");
	return [
		"themes: assign 1-2 themes chosen ONLY from the list below, using the EXACT names. Choose by MECHANISM (the primary lever), never by a keyword the note merely mentions. The first theme is primary and must genuinely match the note's core mechanism. Add a second only if the note substantively contributes to that theme's study. If nothing fits well, pick the single closest.",
		"Available themes:",
		list,
	].join("\n");
}

export const NOTE_RULES: string = [
	"Each note must follow these rules:",
	"",
	"title: a declarative sentence of 6-12 words that states the MECHANISM as a claim (it must contain a verb). It must be understandable without opening the note. Not a topic label ('Confirmation bias') — a claim ('Confirmation bias filters evidence to confirm prior beliefs'). The title must NOT contain any of these characters: : / \\ * ? \" < > |",
	"",
	"lever: a mechanism phrase of 5-12 words describing HOW it works (a verb, a process, or a cause→effect). Never a bare noun or topic label ('habits', 'about biases').",
	"",
	"highlight: the idea in the SOURCE'S OWN WORDS. Copy the exact sentence(s) from the provided text verbatim — do not paraphrase, do not add quotation marks that aren't in the source. Remove any trailing page markers like 'p.23' or '(p. 23)'.",
	"",
	"example: if the source gives a concrete case, story, or experiment for this idea, include it (verbatim or lightly trimmed) in the example field. Otherwise omit the field entirely. Never invent an example.",
	"",
	"page: the page number if the source shows one for this idea (e.g. extracted from 'p.23'). Otherwise omit the field.",
	"",
	"NEVER invent content that is not supported by the source text.",
].join("\n");

export const OUTPUT_FORMAT: string = [
	"OUTPUT FORMAT — read carefully:",
	"Return ONLY a JSON array, with no prose before or after and no markdown code fences.",
	'Each element: {"title": string, "lever": string, "themes": string[], "highlight": string, "example"?: string, "page"?: string}.',
	"Omit the optional fields entirely when they do not apply (do not return empty strings for them).",
	"If there is nothing worth keeping, return an empty array: []",
].join("\n");

function tail(settings: CuratorSettings): string {
	const parts: string[] = [];
	if (settings.maxNotes > 0) {
		parts.push(
			`Produce at most ${settings.maxNotes} notes; keep only the most important mechanisms if there are more.`
		);
	}
	if (settings.extraInstructions.trim()) {
		parts.push("Additional user instructions (follow these):\n" + settings.extraInstructions.trim());
	}
	parts.push(
		"LANGUAGE: write title, lever, highlight and example in the SOURCE's language, regardless of the language of these instructions."
	);
	return parts.join("\n\n");
}

// --- highlights mode (curate the active note) ---

export function buildSystemPrompt(settings: CuratorSettings): string {
	return [
		"You are an expert Zettelkasten curator. You turn raw, messy notes and book highlights into clean ATOMIC notes — one idea each, self-contained.",
		"Extract the durable ideas worth keeping; merge duplicates; drop filler, transitions, and anything that is not a reusable mechanism. One passage with three ideas becomes three notes. When in doubt, drop — do not inflate.",
		"",
		buildThemeInstruction(settings),
		"",
		NOTE_RULES,
		"",
		tail(settings),
		"",
		OUTPUT_FORMAT,
	].join("\n");
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
