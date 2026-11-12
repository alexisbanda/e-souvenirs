import type { GenerateContentRequest, GenerateContentResult, GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiTextFallbackModel, getGeminiTextModel } from "./ai-models";

// Gemini responde 503 ("This model is currently experiencing high demand") o 429
// en picos de demanda. Son fallos pasajeros: reintentamos con una pausa corta y,
// si el modelo principal sigue saturado, probamos con el modelo de respaldo.

const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

/** Error lanzado cuando ningún modelo respondió tras agotar los reintentos. */
export class GeminiUnavailableError extends Error {
  constructor(public readonly cause: unknown) {
    super("Gemini is temporarily unavailable.");
    this.name = "GeminiUnavailableError";
  }
}

export const isTransientGeminiError = (error: unknown): boolean => {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && TRANSIENT_STATUSES.has(status);
};

export interface GeminiRetryOptions {
  /** Intentos por modelo (incluye el primero). */
  attemptsPerModel?: number;
  /** Pausa entre intentos del mismo modelo, en ms. */
  delayMs?: number;
  /** Inyectable en tests para no esperar de verdad. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Modelos a probar, en orden: el principal y, si es distinto, el de respaldo. */
export const getGeminiTextModelChain = (): string[] => {
  const primary = getGeminiTextModel();
  const fallback = getGeminiTextFallbackModel();
  return fallback && fallback !== primary ? [primary, fallback] : [primary];
};

/**
 * Llama a `generateContent` reintentando los errores pasajeros (429/5xx) y
 * cayendo al modelo de respaldo. Los errores no pasajeros (400, 403, 404…) se
 * propagan tal cual al primer intento. Si todo falla, lanza GeminiUnavailableError.
 */
export const generateContentWithRetry = async (
  genAI: GoogleGenerativeAI,
  request: GenerateContentRequest,
  { attemptsPerModel = 2, delayMs = 1000, sleep = defaultSleep }: GeminiRetryOptions = {},
): Promise<GenerateContentResult> => {
  let lastError: unknown;

  for (const modelName of getGeminiTextModelChain()) {
    const model = genAI.getGenerativeModel({ model: modelName });

    for (let attempt = 1; attempt <= attemptsPerModel; attempt++) {
      try {
        return await model.generateContent(request);
      } catch (error) {
        if (!isTransientGeminiError(error)) throw error;
        lastError = error;
        console.warn(
          `[Gemini] ${modelName} falló con ${(error as { status?: number }).status} (intento ${attempt}/${attemptsPerModel}).`,
        );
        if (attempt < attemptsPerModel) await sleep(delayMs);
      }
    }
  }

  throw new GeminiUnavailableError(lastError);
};
