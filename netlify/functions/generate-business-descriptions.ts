import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Handler } from "@netlify/functions";

type BusinessDescriptionSuggestion = {
  headline: string;
  description: string;
  targetAudience: string;
  salesObjective: string;
};

type RequestPayload = {
  companyName?: string;
  seedDescription?: string;
};

type AiResponse = {
  options: BusinessDescriptionSuggestion[];
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GEMINI_API_KEY is not configured." }),
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

  const companyName = payload.companyName?.trim() || "Tu marca";
  const seedDescription = payload.seedDescription?.trim();

  if (!seedDescription) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing 'seedDescription' in request body." }),
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Actúa como estratega de marca para un marketplace de recuerdos personalizados llamado E-souvenirs.
Con la siguiente información inicial sobre un negocio: "${seedDescription}" y el nombre parcial o provisional "${companyName}", genera exactamente 3 propuestas refinadas de narrativa comercial.
Cada propuesta debe incluir:
- headline: una frase corta y atractiva que resuma el posicionamiento de la marca.
- description: una descripción de negocio de 2 a 3 frases en español que explique qué vende, cómo lo hace único y qué experiencia promete al cliente.
- targetAudience: un resumen en una frase del tipo de cliente ideal.
- salesObjective: una frase clara del objetivo principal de venta (por ejemplo, "Incrementar ventas de recuerdos corporativos premium" o "Cerrar pedidos recurrentes para eventos sociales").

Responde únicamente en JSON válido con la forma:
{
  "options": [
    {
      "headline": "...",
      "description": "...",
      "targetAudience": "...",
      "salesObjective": "..."
    }
  ]
}
No incluyas texto adicional fuera del JSON.`;

    const response = await model.generateContent({
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
                },
                required: ["headline", "description", "targetAudience", "salesObjective"],
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

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    console.error("Error generating business descriptions:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: message }),
    };
  }
};
