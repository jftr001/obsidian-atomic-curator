import { requestUrl } from "obsidian";
import { CuratorSettings } from "./settings";

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Call the Anthropic Messages API using Obsidian's requestUrl,
 * which avoids browser CORS restrictions and works on desktop and mobile.
 * Returns the assistant's text content.
 */
export async function callAnthropic(
	settings: CuratorSettings,
	systemPrompt: string,
	userPrompt: string,
	maxTokens: number = DEFAULT_MAX_TOKENS
): Promise<string> {
	if (!settings.apiKey) {
		throw new Error("No Anthropic API key set. Add one in the plugin settings.");
	}

	const response = await requestUrl({
		url: API_URL,
		method: "POST",
		throw: false,
		headers: {
			"content-type": "application/json",
			"x-api-key": settings.apiKey,
			"anthropic-version": ANTHROPIC_VERSION,
		},
		body: JSON.stringify({
			model: settings.model,
			max_tokens: maxTokens,
			system: systemPrompt,
			messages: [{ role: "user", content: userPrompt }],
		}),
	});

	if (response.status < 200 || response.status >= 300) {
		throw new Error(describeError(response.status, response.json, response.text));
	}

	const data = response.json;
	const text = extractText(data);
	if (!text) {
		throw new Error("The API returned an empty response.");
	}
	return text;
}

function extractText(data: unknown): string {
	if (!data || typeof data !== "object") return "";
	const content = (data as { content?: unknown }).content;
	if (!Array.isArray(content)) return "";
	return content
		.filter(
			(block): block is { type: string; text: string } =>
				!!block &&
				typeof block === "object" &&
				(block as { type?: unknown }).type === "text" &&
				typeof (block as { text?: unknown }).text === "string"
		)
		.map((block) => block.text)
		.join("");
}

function describeError(status: number, json: unknown, text: string): string {
	let detail = "";
	if (json && typeof json === "object") {
		const err = (json as { error?: { message?: string } }).error;
		if (err?.message) detail = err.message;
	}
	if (!detail) detail = text || "Unknown error";

	if (status === 401) {
		return "Anthropic rejected the API key (401). Check it in the plugin settings.";
	}
	if (status === 429) {
		return "Rate limited by Anthropic (429). Wait a moment and try again.";
	}
	if (status === 400 && /model/i.test(detail)) {
		return `Anthropic rejected the request: ${detail}. Try a different model in settings.`;
	}
	return `Anthropic API error (${status}): ${detail}`;
}
