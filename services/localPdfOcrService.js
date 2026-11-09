import path from "node:path";

const OCR_RENDER_SCALE = 2;
const OCR_MAX_PIXELS = 8_000_000;
const OCR_MAX_DIMENSION = 4_000;
const OCR_MIN_CONFIDENCE = 0.2;
const OCR_MIN_TEXT_QUALITY = 0.15;
const OCR_PAGE_TIMEOUT_MS = 60_000;
const OCR_MAX_PAGES_PER_DOCUMENT = 200;
const OCR_MAX_DOCUMENT_DURATION_MS = 10 * 60_000;

let dependenciesPromise;
let workerPromise;
let queue = Promise.resolve();

export function createDocumentOcrProvider(provider) {
  let pageCount = 0;
  let startedAt = null;
  return {
    async processPage(input) {
      startedAt ??= Date.now();
      pageCount += 1;
      if (pageCount > OCR_MAX_PAGES_PER_DOCUMENT) {
        throw ocrError("OCR_PAGE_LIMIT", "The document exceeds the OCR page limit");
      }
      if (Date.now() - startedAt > OCR_MAX_DOCUMENT_DURATION_MS) {
        throw ocrError("OCR_DOCUMENT_TIMEOUT", "The document exceeded its OCR time limit");
      }
      return provider.processPage(input);
    },
  };
}

function ocrError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function loadDependencies() {
  if (!dependenciesPromise) {
    dependenciesPromise = Promise.all([
      import("@napi-rs/canvas"),
      import("tesseract.js"),
      import("@tesseract.js-data/eng"),
    ]).then(([canvasModule, tesseractModule, languageModule]) => ({
      createCanvas: canvasModule.createCanvas,
      createWorker: tesseractModule.createWorker,
      englishData: languageModule.default || languageModule,
    })).catch((error) => {
      dependenciesPromise = null;
      throw ocrError("OCR_RUNTIME_UNAVAILABLE", error.message);
    });
  }
  return dependenciesPromise;
}

async function getWorker(createWorker, englishData) {
  if (!workerPromise) {
    workerPromise = createWorker(englishData.code, undefined, {
      langPath: path.resolve(englishData.langPath),
      gzip: englishData.gzip,
      cacheMethod: "none",
    }).catch(async (error) => {
      workerPromise = null;
      throw ocrError("OCR_RUNTIME_UNAVAILABLE", error.message);
    });
  }
  return workerPromise;
}

async function disposeWorker(expectedWorkerPromise, worker = null) {
  if (workerPromise === expectedWorkerPromise) {
    workerPromise = null;
  }
  const workerToTerminate = worker || await expectedWorkerPromise.catch(() => null);
  await workerToTerminate?.terminate();
}

function createCanvasFactory(createCanvas) {
  return {
    create(width, height) {
      const canvas = createCanvas(width, height);
      return { canvas, context: canvas.getContext("2d") };
    },
    reset(canvasAndContext, width, height) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
      canvasAndContext.context = canvasAndContext.canvas.getContext("2d");
    },
    destroy(canvasAndContext) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    },
  };
}

function renderScale(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw ocrError("OCR_FAILED", "PDF page dimensions are invalid");
  }
  return Math.min(
    OCR_RENDER_SCALE,
    Math.sqrt(OCR_MAX_PIXELS / (width * height)),
    OCR_MAX_DIMENSION / width,
    OCR_MAX_DIMENSION / height,
  );
}

function isBlankPage(context, width, height) {
  const pixels = context.getImageData(0, 0, width, height).data;
  let samples = 0;
  let inkSamples = 0;
  for (let index = 0; index < pixels.length; index += 64) {
    samples += 1;
    if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) {
      inkSamples += 1;
    }
  }
  return inkSamples / samples < 0.00005;
}

async function renderPageImage(pageData, createCanvas) {
  if (typeof globalThis.HTMLElement === "undefined") {
    globalThis.HTMLElement = class HTMLElement {};
  }

  const unscaledViewport = pageData.getViewport(1, pageData.rotate);
  const viewport = pageData.getViewport(
    renderScale(unscaledViewport.width, unscaledViewport.height),
    pageData.rotate,
  );
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  await pageData.render({
    canvasContext: context,
    viewport,
    canvasFactory: createCanvasFactory(createCanvas),
  }).promise;
  const pageRotation = ((Number(pageData.rotate) || 0) % 360 + 360) % 360;
  let alternateCanvas = null;
  if ([90, 270].includes(pageRotation)) {
    alternateCanvas = createCanvas(height, width);
    const alternateContext = alternateCanvas.getContext("2d");
    alternateContext.fillStyle = "#ffffff";
    alternateContext.fillRect(0, 0, height, width);
    alternateContext.translate(height / 2, width / 2);
    alternateContext.rotate((((360 - pageRotation) % 360) * Math.PI) / 180);
    alternateContext.drawImage(canvas, -width / 2, -height / 2);
  }
  return { canvas, context, width, height, alternateCanvas };
}

function serializeOcr(callback) {
  const result = queue.then(callback);
  queue = result.catch(() => {});
  return result;
}

async function recognizePage(worker, image, options, timeoutMs) {
  let timeout;
  let timedOut = false;
  const currentWorkerPromise = workerPromise;
  const recognition = worker.recognize(image, options);
  const timeoutPromise = new Promise((resolve, reject) => {
    timeout = setTimeout(() => {
      timedOut = true;
      void disposeWorker(currentWorkerPromise, worker).then(
        () => reject(ocrError("OCR_TIMEOUT", "OCR page processing exceeded its time limit")),
        reject,
      );
    }, timeoutMs);
    timeout.unref?.();
  });

  try {
    return await Promise.race([recognition, timeoutPromise]);
  } catch (error) {
    if (!timedOut && workerPromise === currentWorkerPromise) {
      await disposeWorker(currentWorkerPromise, worker);
    }
    throw error?.code ? error : ocrError("OCR_FAILED", "OCR page processing failed");
  } finally {
    clearTimeout(timeout);
  }
}

function textQuality(data) {
  const text = typeof data.text === "string" ? data.text.trim() : "";
  const characters = text.replace(/\s/g, "");
  const alphaNumericCount = (characters.match(/[\p{L}\p{N}]/gu) || []).length;
  const tokenCount = (text.match(/[\p{L}\p{N}]{2,}/gu) || []).length;
  const confidence = Number.isFinite(data.confidence) ? data.confidence / 100 : 0;
  const alphaNumericRatio = characters.length ? alphaNumericCount / characters.length : 0;
  return {
    text,
    confidence,
    score: confidence * alphaNumericRatio * Math.min(1, tokenCount / 4),
  };
}

export async function terminateLocalPdfOcrWorker() {
  const currentWorkerPromise = workerPromise;
  if (currentWorkerPromise) await disposeWorker(currentWorkerPromise);
}

export const localPdfOcrProvider = Object.freeze({
  async processPage({ pageData }) {
    return serializeOcr(async () => {
      const { createCanvas, createWorker, englishData } = await loadDependencies();
      const { canvas, context, width, height, alternateCanvas } = await renderPageImage(pageData, createCanvas);
      try {
        if (isBlankPage(context, width, height)) {
          return { status: "blank" };
        }

        const worker = await getWorker(createWorker, englishData);
        const pageStartedAt = Date.now();
        let result = await recognizePage(
          worker,
          canvas.toBuffer("image/png"),
          { rotateAuto: true },
          OCR_PAGE_TIMEOUT_MS,
        );
        if (alternateCanvas) {
          const remainingTimeout = OCR_PAGE_TIMEOUT_MS - (Date.now() - pageStartedAt);
          if (remainingTimeout > 0) {
            const alternateResult = await recognizePage(
              worker,
              alternateCanvas.toBuffer("image/png"),
              { rotateAuto: true },
              remainingTimeout,
            );
            if (textQuality(alternateResult.data).score > textQuality(result.data).score) {
              result = alternateResult;
            }
          }
        }
        const quality = textQuality(result.data);
        const confidence = Number.isFinite(result.data.confidence)
          ? Math.max(0, Math.min(1, quality.confidence))
          : null;
        if (!quality.text
          || confidence === null
          || confidence < OCR_MIN_CONFIDENCE
          || quality.score < OCR_MIN_TEXT_QUALITY) {
          return { status: "unreadable", confidence };
        }
        return { status: "recognized", text: quality.text, confidence };
      } finally {
        canvas.width = 0;
        canvas.height = 0;
        if (alternateCanvas) {
          alternateCanvas.width = 0;
          alternateCanvas.height = 0;
        }
      }
    });
  },
});
