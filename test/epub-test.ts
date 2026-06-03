import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { extractEpub, XmlParser } from "../src/extract/epub";
import { parseAtomicNotes } from "../src/curator";

function assert(cond: boolean, msg: string): void {
	if (!cond) {
		console.error("FAIL:", msg);
		process.exitCode = 1;
	} else {
		console.log("ok:", msg);
	}
}

async function buildSampleEpub(): Promise<ArrayBuffer> {
	const zip = new JSZip();
	zip.file("mimetype", "application/epub+zip");
	zip.file(
		"META-INF/container.xml",
		`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
	);
	zip.file(
		"OEBPS/content.opf",
		`<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata/>
  <manifest>
    <item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="cover"/>
    <itemref idref="c1"/>
    <itemref idref="c2"/>
  </spine>
</package>`
	);
	zip.file(
		"OEBPS/cover.xhtml",
		`<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Cover</title></head><body><p>x</p></body></html>`
	);
	zip.file(
		"OEBPS/ch1.xhtml",
		`<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter One</title></head>
<body><h1>Chapter One</h1><p>The mind&nbsp;works in two systems&mdash;fast and slow.</p>
<p>This paragraph is long enough to clear the forty character minimum for inclusion.</p></body></html>`
	);
	zip.file(
		"OEBPS/ch2.xhtml",
		`<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter Two</title></head>
<body><h2>Chapter Two</h2><p>Losses loom larger than gains, which is the core of loss aversion theory.</p></body></html>`
	);
	const buf = await zip.generateAsync({ type: "nodebuffer" });
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function main(): Promise<void> {
	const data = await buildSampleEpub();
	const parser = new DOMParser() as unknown as XmlParser;
	const chapters = await extractEpub(data, parser);

	assert(chapters.length === 2, `cover skipped, 2 readable chapters (got ${chapters.length})`);
	assert(chapters[0].title === "Chapter One", `chapter 1 title (got "${chapters[0]?.title}")`);
	assert(chapters[1].title === "Chapter Two", `chapter 2 title (got "${chapters[1]?.title}")`);
	assert(chapters[0].text.includes("mind works"), "nbsp decoded to space");
	assert(chapters[0].text.includes("systems—fast"), "mdash decoded");
	assert(!/<[^>]+>/.test(chapters[0].text), "no raw HTML tags remain");
	assert(chapters[1].text.includes("loss aversion"), "chapter 2 body extracted");
	console.log("\n--- chapter 1 text ---\n" + chapters[0].text);

	// parseAtomicNotes robustness
	const notes = parseAtomicNotes(
		'Here you go:\n```json\n[{"title":"A","body":"b","tags":["x"]},{"title":"","body":"skip"}]\n```\nDone.'
	);
	assert(notes.length === 1, `parseAtomicNotes drops invalid + strips fences (got ${notes.length})`);
	assert(notes[0].tags[0] === "x", "tag preserved");

	console.log("\nDONE");
}

main().catch((e) => {
	console.error("ERROR", e);
	process.exitCode = 1;
});
