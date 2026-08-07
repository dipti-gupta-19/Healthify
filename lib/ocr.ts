let workerPromise: Promise<import('tesseract.js').Worker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng');
    })();
  }
  return workerPromise;
}

export async function extractTextFromImage(imageSource: string | File): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageSource);
  return data.text.trim();
}

export async function terminateOcrWorker() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
