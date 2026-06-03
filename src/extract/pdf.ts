import {
	GlobalWorkerOptions,
	getDocument,
	PdfDocument,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDF_WORKER_BASE64 } from "../pdf-worker-inline";

let workerReady = false;

function ensureWorker(): void {
	if (workerReady) return;
	const binary = atob(PDF_WORKER_BASE64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	const blob = new Blob([bytes], { type: "text/javascript" });
	GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
	workerReady = true;
}

export interface LoadedPdf {
	doc: PdfDocument;
	destroy(): Promise<void>;
}

export async function loadPdf(data: ArrayBuffer): Promise<LoadedPdf> {
	ensureWorker();
	const task = getDocument({ data: new Uint8Array(data), isEvalSupported: false });
	const doc = await task.promise;
	return { doc, destroy: () => task.destroy() };
}

/** Extract text from an inclusive 1-based page range. */
export async function extractPdfRange(
	doc: PdfDocument,
	fromPage: number,
	toPage: number
): Promise<string> {
	const start = Math.max(1, fromPage);
	const end = Math.min(doc.numPages, toPage);
	const pages: string[] = [];
	for (let p = start; p <= end; p++) {
		const page = await doc.getPage(p);
		const content = await page.getTextContent();
		const line = content.items
			.map((it) => (it && typeof it.str === "string" ? it.str : ""))
			.join(" ");
		pages.push(line.replace(/\s+/g, " ").trim());
	}
	return pages.join("\n\n").trim();
}
