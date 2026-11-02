// Nombres de los modelos de IA usados por las Netlify Functions, configurables por
// variable de entorno para poder actualizarlos sin tocar código cuando Google
// retire o reemplace un modelo.
//
// Referencias de vigencia (ver PR #4):
// - Texto (Gemini API): https://ai.google.dev/gemini-api/docs/models y
//   https://ai.google.dev/gemini-api/docs/deprecations (gemini-2.0-flash se retira
//   el 1 de junio de 2026; gemini-3.8-flash es el modelo estable vigente con
//   salida estructurada).
// - Imagen (Vertex AI, llamada `predict`):
//   https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/imagen/4-0-fast-generate-001
//   indica que `imagen-4.0-fast-generate-001` está deprecado con fecha límite
//   30 de junio de 2026, recomendando migrar a `gemini-2.5-flash-image`. Ese
//   sucesor usa `generateContent`, no `predict`, así que cambiar de modelo
//   implicaría cambiar la forma de la llamada (fuera del alcance de este
//   ticket). Por eso el valor por defecto se mantiene en
//   `imagen-4.0-fast-generate-001` hasta que se aborde esa migración.

const DEFAULT_GEMINI_TEXT_MODEL = 'gemini-3.8-flash';
const DEFAULT_IMAGEN_MODEL = 'imagen-4.0-fast-generate-001';

const resolveModel = (envValue: string | undefined, defaultValue: string): string => {
  const trimmed = (envValue ?? '').trim();
  return trimmed || defaultValue;
};

/** Modelo de texto de la Gemini API. Lee `GEMINI_TEXT_MODEL` en tiempo de ejecución. */
export const getGeminiTextModel = (): string =>
  resolveModel(process.env.GEMINI_TEXT_MODEL, DEFAULT_GEMINI_TEXT_MODEL);

/** Modelo de imagen de Vertex AI (Imagen). Lee `IMAGEN_MODEL` en tiempo de ejecución. */
export const getImagenModel = (): string =>
  resolveModel(process.env.IMAGEN_MODEL, DEFAULT_IMAGEN_MODEL);
