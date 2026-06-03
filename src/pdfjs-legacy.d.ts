declare module "pdfjs-dist/legacy/build/pdf.mjs" {
	export const GlobalWorkerOptions: { workerSrc: string };
	export interface PdfTextItem {
		str?: string;
	}
	export interface PdfTextContent {
		items: PdfTextItem[];
	}
	export interface PdfPage {
		getTextContent(): Promise<PdfTextContent>;
	}
	export interface PdfDocument {
		numPages: number;
		getPage(n: number): Promise<PdfPage>;
		cleanup(): Promise<void>;
	}
	export interface PdfLoadingTask {
		promise: Promise<PdfDocument>;
		destroy(): Promise<void>;
	}
	export function getDocument(src: {
		data: Uint8Array;
		isEvalSupported?: boolean;
	}): PdfLoadingTask;
	export const version: string;
}
