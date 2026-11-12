// Nombres de los modelos de IA usados por las Netlify Functions, configurables por
// variable de entorno para poder actualizarlos sin tocar código cuando Google
// retire o reemplace un modelo.
//
// Referencias de vigencia (ver ticket #4):
// - Texto (Gemini API): https://ai.google.dev/gemini-api/docs/models,
//   https://ai.google.dev/gemini-api/docs/deprecations (gemini-2.0-flash se cerró
//   el 1 de junio de 2026) y
//   https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite.
//   El valor por defecto es `gemini-3.5-flash-lite`: en las pruebas en el
//   deploy preview del 2026-11-02, `gemini-3.8-flash` respondió 503 por alta
//   demanda en todos los intentos, mientras que `gemini-3.5-flash-lite`
//   respondió correctamente (ver PR #27).
// - Imagen (Vertex AI, llamada `predict`):
//   https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/imagen/4-0-fast-generate-001
//   indica que `imagen-4.0-fast-generate-001` está deprecado y que Google
//   recomendaba migrar antes del 30 de junio de 2026 a `gemini-2.5-flash-image`.
//   No hemos comprobado si `imagen-4.0-fast-generate-001` sigue respondiendo tras
//   esa fecha. El sucesor usa `generateContent`, no `predict`, así que cambiar de
//   modelo implicaría cambiar la forma de la llamada (fuera del alcance de este
//   ticket). Por eso el valor por defecto se mantiene en
//   `imagen-4.0-fast-generate-001` hasta que se aborde esa migración.

const DEFAULT_GEMINI_TEXT_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_IMAGEN_MODEL = 'imagen-4.0-fast-generate-001';
// Respaldo cuando el modelo principal responde 503/429 por alta demanda. Es un
// modelo distinto para no depender de la misma capacidad. `none` lo desactiva.
const DEFAULT_GEMINI_TEXT_FALLBACK_MODEL = 'gemini-3.8-flash';

const resolveModel = (envValue: string | undefined, defaultValue: string): string => {
  const trimmed = (envValue ?? '').trim();
  return trimmed || defaultValue;
};

/** Modelo de texto de la Gemini API. Lee `GEMINI_TEXT_MODEL` en tiempo de ejecución. */
export const getGeminiTextModel = (): string =>
  resolveModel(process.env.GEMINI_TEXT_MODEL, DEFAULT_GEMINI_TEXT_MODEL);

/**
 * Modelo de texto de respaldo. Lee `GEMINI_TEXT_FALLBACK_MODEL`; con el valor
 * `none` devuelve null y no se usa respaldo.
 */
export const getGeminiTextFallbackModel = (): string | null => {
  const model = resolveModel(process.env.GEMINI_TEXT_FALLBACK_MODEL, DEFAULT_GEMINI_TEXT_FALLBACK_MODEL);
  return model.toLowerCase() === 'none' ? null : model;
};

/** Modelo de imagen de Vertex AI (Imagen). Lee `IMAGEN_MODEL` en tiempo de ejecución. */
export const getImagenModel = (): string =>
  resolveModel(process.env.IMAGEN_MODEL, DEFAULT_IMAGEN_MODEL);
