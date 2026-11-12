import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Handler } from "@netlify/functions";
import { GeminiUnavailableError, generateContentWithRetry } from "../lib/gemini-retry";
import { verifyTurnstileToken } from "../lib/turnstile";
import { MAX_COMPANY_NAME_LENGTH, MAX_SEED_DESCRIPTION_LENGTH } from "../../utils/aiLimits";


type BusinessDescriptionSuggestion = {
  headline: string;
  description: string;
  targetAudience: string;
  salesObjective: string;
  welcomeMessage: string;
  aiPrompt: string;
};

type RequestPayload = {
  companyName?: unknown;
  seedDescription?: unknown;
  turnstileToken?: unknown;
};

type AiResponse = {
  options: BusinessDescriptionSuggestion[];
};

const normalizeText = (text?: string) =>
  (text || '')
    .replace(/\s+/g, ' ')
    .trim();

const buildAiPrompt = (companyName: string, option: BusinessDescriptionSuggestion): string => {
  const safeCompanyName = normalizeText(companyName) || 'E-souvenirs';
  const headline = normalizeText(option.headline);
  const description = normalizeText(option.description);
  const targetAudience = normalizeText(option.targetAudience);
  const salesObjective = normalizeText(option.salesObjective);

  const contextLines = [
    headline ? `Esta marca se posiciona como "${headline}".` : '',
    description ? description : '',
    targetAudience ? `Cliente ideal objetivo: ${targetAudience}.` : '',
    salesObjective ? `Objetivo comercial prioritario: ${salesObjective}.` : '',
  ]
    .filter(Boolean)
    .join('\n          ');

  return `
          Actúa como un director creativo en "{companyName}", una tienda de souvenirs personalizados.
          La marca se llama ${safeCompanyName}.
          ${contextLines}

          Un cliente está interesado en este concepto: {baseConcept}.
          La idea original del cliente era: "{userInput}".

          Si {baseConcept} está vacío, genera conceptos originales aprovechando la idea indicada en "{userInput}".
          Tu tarea es generar 3 NUEVAS variaciones de este concepto. Deben ser diferentes pero manteniendo la esencia del original.
          Piensa en diferentes materiales, estilos o formas de personalización alineadas con las expectativas del cliente ideal.
          Debes responder únicamente con un objeto JSON que contenga una clave "concepts".
          El valor de "concepts" debe ser un array de 3 objetos, cada uno con "name", "description", "materials", y "imagePrompt".
          El "imagePrompt" debe ser una descripción detallada en inglés para una IA generativa de imágenes. Debe ser fotorrealista y describir el producto, el fondo y el estilo. (ej. "Photorealistic product shot of a bronze anchor keychain, engraved with 'Class of 2025', on a dark wooden table").
          Ejemplo de respuesta JSON:
          {
            "concepts": [
              {
                "name": "Ejemplo de Concepto",
                "description": "Descripción breve del souvenir propuesto, enfatizando el estilo de la marca.",
                "materials": ["Material 1", "Material 2"],
                "imagePrompt": "Photorealistic product shot of ..."
              }
            ]
          }
        `;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  let payload: RequestPayload;
  try {
    payload = JSON.parse(event.body || "{}") as RequestPayload;
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON payload." }),
    };
  }

  if (typeof payload !== "object" || payload === null) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON payload." }),
    };
  }

  const turnstile = await verifyTurnstileToken({
    token: payload.turnstileToken,
    remoteIp: event.headers["x-nf-client-connection-ip"],
  });
  if (!turnstile.ok) {
    if (turnstile.reason === "missing-secret") {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Internal server configuration error." }),
      };
    }
    if (turnstile.reason === "unavailable") {
      return {
        statusCode: 503,
        body: JSON.stringify({ error: "Turnstile verification is unavailable." }),
      };
    }
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "Turnstile verification failed." }),
    };
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GEMINI_API_KEY is not configured." }),
    };
  }

  if (
    payload.companyName !== undefined &&
    (typeof payload.companyName !== "string" || payload.companyName.length > MAX_COMPANY_NAME_LENGTH)
  ) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `'companyName' must be a string of at most ${MAX_COMPANY_NAME_LENGTH} characters.` }),
    };
  }

  if (
    typeof payload.seedDescription !== "string" ||
    !payload.seedDescription.trim() ||
    payload.seedDescription.length > MAX_SEED_DESCRIPTION_LENGTH
  ) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `'seedDescription' must be a non-empty string of at most ${MAX_SEED_DESCRIPTION_LENGTH} characters.` }),
    };
  }

  const companyName = payload.companyName?.trim() || "Tu marca";
  const seedDescription = payload.seedDescription.trim();

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    const prompt = `Actúa como estratega de marca y copywriter para un marketplace de souvenirs/artículos/productos personalizados llamado "${companyName}".
Con la siguiente información inicial sobre un negocio: "${seedDescription}" y el nombre provisional "${companyName}", genera exactamente 3 propuestas refinadas de narrativa comercial.
Cada propuesta debe incluir:
- headline: una frase corta y atractiva que resuma el posicionamiento de la marca.
- description: una descripción de negocio de 2 a 3 frases en español que explique qué vende, cómo lo hace único y qué experiencia promete al cliente.
- targetAudience: un resumen en una frase del tipo de cliente ideal.
- salesObjective: una frase clara del objetivo principal de venta (por ejemplo, "Incrementar ventas de souvenirs/productos/artículos corporativos premium" o "Cerrar pedidos recurrentes para eventos sociales").
- welcomeMessage: dos frases cálidas en español para mostrar en la tienda al recibir a los visitantes, mencionando el nombre de la marca o la experiencia que vivirán.
- aiPrompt: instrucciones detalladas en español para un asistente de IA generativa que diseña souvenirs. Debe incluir el tono de la marca, el cliente ideal, el objetivo de venta y cómo debe responder el asistente (estructura sugerida, tipo de materiales o estilos a priorizar, idioma de salida). Máximo 1200 caracteres.

Responde únicamente en JSON válido con la forma:
{
  "options": [
    {
      "headline": "...",
      "description": "...",
      "targetAudience": "...",
      "salesObjective": "...",
      "welcomeMessage": "...",
      "aiPrompt": "..."
    }
  ]
}
No incluyas texto adicional fuera del JSON.`;

    const response = await generateContentWithRetry(genAI, {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            options: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  headline: { type: SchemaType.STRING },
                  description: { type: SchemaType.STRING },
                  targetAudience: { type: SchemaType.STRING },
                  salesObjective: { type: SchemaType.STRING },
                  welcomeMessage: { type: SchemaType.STRING },
                  aiPrompt: { type: SchemaType.STRING },
                },
                required: [
                  "headline",
                  "description",
                  "targetAudience",
                  "salesObjective",
                  "welcomeMessage",
                  "aiPrompt",
                ],
              },
              minItems: 3,
              maxItems: 3,
            },
          },
          required: ["options"],
        },
      },
    });

    const jsonText = response.response.text();
    const parsed = JSON.parse(jsonText) as AiResponse;

    const normalizedOptions = (parsed.options || []).map((option) => {
      const normalizedOption: BusinessDescriptionSuggestion = {
        ...option,
        headline: normalizeText(option.headline),
        description: normalizeText(option.description),
        targetAudience: normalizeText(option.targetAudience),
        salesObjective: normalizeText(option.salesObjective),
        welcomeMessage: normalizeText(option.welcomeMessage),
        aiPrompt: '',
      };

      normalizedOption.aiPrompt = buildAiPrompt(companyName, normalizedOption);

      return normalizedOption;
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ options: normalizedOptions }),
    };
  } catch (error) {
    // El detalle (en inglés, de Google) solo va al log; al cliente le damos un
    // código para que muestre su propio mensaje traducido.
    console.error("Error generating business descriptions:", error);
    const code = error instanceof GeminiUnavailableError ? "ai_unavailable" : "ai_error";
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: code }),
    };
  }
};
