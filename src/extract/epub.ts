import JSZip from "jszip";

export interface EpubChapter {
	index: number; // 1-based position in the reading order
	title: string;
	text: string;
}

/**
 * Minimal DOMParser shape — satisfied by the browser's DOMParser (in Obsidian)
 * and by @xmldom/xmldom in tests. Only used for the small, well-formed
 * container.xml and OPF files; chapter HTML is stripped with regex instead,
 * which is more tolerant of real-world EPUB content.
 */
export interface XmlParser {
	parseFromString(source: string, mimeType: string): XmlDocLike;
}
interface XmlDocLike {
	getElementsByTagName(name: string): ArrayLike<XmlElLike>;
}
interface XmlElLike {
	getAttribute(name: string): string | null;
}

export async function extractEpub(
	data: ArrayBuffer,
	parser: XmlParser
): Promise<EpubChapter[]> {
	const zip = await JSZip.loadAsync(data);

	const opfPath = await findOpfPath(zip, parser);
	const opfDir = dirname(opfPath);
	const opfXml = await readZipText(zip, opfPath);
	if (opfXml === null) throw new Error("EPUB OPF file could not be read.");
	const opf = parser.parseFromString(opfXml, "application/xml");

	// manifest: id -> href
	const idToHref: Record<string, string> = {};
	const items = opf.getElementsByTagName("item");
	for (let i = 0; i < items.length; i++) {
		const id = items[i].getAttribute("id");
		const href = items[i].getAttribute("href");
		if (id && href) idToHref[id] = href;
	}

	// spine defines reading order
	const chapters: EpubChapter[] = [];
	const itemrefs = opf.getElementsByTagName("itemref");
	for (let i = 0; i < itemrefs.length; i++) {
		const idref = itemrefs[i].getAttribute("idref");
		if (!idref) continue;
		const href = idToHref[idref];
		if (!href) continue;

		const html = await readZipText(zip, joinPath(opfDir, href));
		if (html === null) continue;

		const text = htmlToText(html);
		if (text.trim().length < 40) continue; // skip covers, blank pages, tiny nav docs

		const title = extractTitle(html) || `Section ${chapters.length + 1}`;
		chapters.push({ index: chapters.length + 1, title, text });
	}

	if (chapters.length === 0) {
		throw new Error("No readable chapters found in this EPUB.");
	}
	return chapters;
}

async function findOpfPath(zip: JSZip, parser: XmlParser): Promise<string> {
	const containerXml = await readZipText(zip, "META-INF/container.xml");
	if (containerXml === null) {
		throw new Error("Not a valid EPUB: missing META-INF/container.xml.");
	}
	const container = parser.parseFromString(containerXml, "application/xml");
	const rootfiles = container.getElementsByTagName("rootfile");
	const opfPath = rootfiles.length ? rootfiles[0].getAttribute("full-path") : null;
	if (!opfPath) throw new Error("Not a valid EPUB: could not locate the OPF file.");
	return opfPath;
}

async function readZipText(zip: JSZip, path: string): Promise<string | null> {
	const norm = path.replace(/^\.\//, "").replace(/\\/g, "/");
	const file = zip.file(norm) || zip.file(decodeURIComponent(norm));
	if (!file) return null;
	return file.async("string");
}

// --- HTML -> text (regex-based, tolerant of imperfect XHTML) ---

function htmlToText(html: string): string {
	let s = html;
	s = s.replace(/<\?[\s\S]*?\?>/g, " "); // processing instructions
	s = s.replace(/<!--[\s\S]*?-->/g, " "); // comments
	s = s.replace(/<head[\s\S]*?<\/head>/gi, " ");
	s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
	s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
	// block-level closers and breaks become newlines
	s = s.replace(/<br\s*\/?>/gi, "\n");
	s = s.replace(/<\/(p|div|h[1-6]|li|tr|section|article|blockquote|figcaption)>/gi, "\n");
	s = s.replace(/<[^>]+>/g, " "); // strip remaining tags
	s = decodeEntities(s);
	return normalizeWhitespace(s);
}

function extractTitle(html: string): string {
	const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
	if (titleTag && titleTag[1].trim()) {
		return normalizeWhitespace(decodeEntities(stripTags(titleTag[1])));
	}
	for (const tag of ["h1", "h2", "h3"]) {
		const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(html);
		if (m && m[1].trim()) {
			return normalizeWhitespace(decodeEntities(stripTags(m[1])));
		}
	}
	return "";
}

function stripTags(s: string): string {
	return s.replace(/<[^>]+>/g, " ");
}

const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	mdash: "—",
	ndash: "–",
	hellip: "…",
	ldquo: "“",
	rdquo: "”",
	lsquo: "‘",
	rsquo: "’",
	copy: "©",
	reg: "®",
	trade: "™",
};

function decodeEntities(s: string): string {
	return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
		if (body[0] === "#") {
			const code =
				body[1] === "x" || body[1] === "X"
					? parseInt(body.slice(2), 16)
					: parseInt(body.slice(1), 10);
			return Number.isFinite(code) ? String.fromCodePoint(code) : match;
		}
		const named = NAMED_ENTITIES[body.toLowerCase()];
		return named !== undefined ? named : match;
	});
}

function normalizeWhitespace(s: string): string {
	return s
		.replace(/\r\n?/g, "\n")
		.replace(/[ \t\f\v]+/g, " ")
		.replace(/ *\n */g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

// --- path helpers (POSIX-style, EPUB paths always use "/") ---

function dirname(path: string): string {
	const i = path.lastIndexOf("/");
	return i === -1 ? "" : path.slice(0, i);
}

function joinPath(dir: string, rel: string): string {
	const base = dir ? dir.split("/") : [];
	for (const part of rel.split("/")) {
		if (part === "" || part === ".") continue;
		if (part === "..") base.pop();
		else base.push(part);
	}
	return base.join("/");
}
