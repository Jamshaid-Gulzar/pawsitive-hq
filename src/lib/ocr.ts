// Browser-only OCR with Tesseract.js: free, no API key, runs on the visitor's
// device. The engine and English data download from a CDN on first use.

export async function readText(image: string, onProgress?: (fraction: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
