import { readFileSync } from "fs";
import {
	getDocument,
	GlobalWorkerOptions,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPdfRange } from "../src/extract/pdf";

import { resolve } from "path";
import { pathToFileURL } from "url";

// In Node we point the worker at the on-disk file. In Obsidian the plugin uses
// an inlined Blob worker instead; this test only validates the extraction logic.
GlobalWorkerOptions.workerSrc = pathToFileURL(
	resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs")
).href;

async function main(): Promise<void> {
	const path = process.argv[2];
	if (!path) {
		console.error("usage: node pdf-test.cjs <file.pdf>");
		process.exitCode = 1;
		return;
	}
	const buf = readFileSync(path);
	const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
	const task = getDocument({
		data: new Uint8Array(data),
		isEvalSupported: false,
	});
	const doc = await task.promise;
	console.log("numPages:", doc.numPages);
	const text = await extractPdfRange(doc, 1, Math.min(doc.numPages, 1));
	console.log("page 1 chars:", text.length);
	console.log("--- first 400 chars ---\n" + text.slice(0, 400));
	await task.destroy();
	console.log("\nDONE");
}

main().catch((e) => {
	console.error("ERROR", e);
	process.exitCode = 1;
});
