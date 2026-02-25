/**
 * Lazy loader for pdfjs-dist (code-splitting).
 * Both PdfViewer.tsx and fileProcessing.ts share this singleton
 * to avoid downloading the library twice.
 */

// Worker URL at module level so Vite can statically resolve it
const PDF_WORKER_URL = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

let _module: typeof import('pdfjs-dist') | null = null;
let _promise: Promise<typeof import('pdfjs-dist')> | null = null;

/** Load pdfjs-dist on demand. Caches the module after first load. */
export function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (_module) return Promise.resolve(_module);
  if (!_promise) {
    _promise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
      _module = mod;
      return mod;
    });
  }
  return _promise;
}
