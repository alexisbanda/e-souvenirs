import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

// Define the expected structure of the incoming request body
interface RequestBody {
  userInput: string;
  baseConcept?: SouvenirConcept;
  companySettings?: {
    aiPrompt?: string;
    name?: string;
  };
}

// Define the structure of the successful response body
export interface SouvenirConcept {
  name: string;
  description: string;
  materials: string[];
  imagePrompt: string;
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log("Received event body:", event.body);
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key is not configured." }) };
  }

  try {
    const { userInput, baseConcept, companySettings } = JSON.parse(event.body || "{}") as RequestBody;
    if (!userInput) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'userInput' in request body." }) };
    }

    // Usa el prompt personalizado si está presente
    let prompt = '';
    if (companySettings?.aiPrompt) {
      prompt = companySettings.aiPrompt
        .replace(/\{companyName\}/g, companySettings.name || 'Recuerdos Artesanales')
        .replace(/\{userInput\}/g, userInput)
        .replace(/\{baseConcept\}/g, baseConcept ? JSON.stringify(baseConcept) : '');
    } else {
      prompt = baseConcept
        ? `
          Actúa como un director creativo en "Recuerdos Artesanales".
          Un cliente está interesado en este concepto: ${JSON.stringify(baseConcept)}.
          La idea original del cliente era: "${userInput}".

          Tu tarea es generar 3 NUEVAS variaciones de este concepto. Deben ser diferentes pero manteniendo la esencia del original.
          Piensa en diferentes materiales, estilos, o formas de personalización.
          Por ejemplo, si el original era "rústico", una variación podría ser "moderno y minimalista".

          Debes responder únicamente con un objeto JSON que contenga una clave "concepts".
          El valor de "concepts" debe ser un array de 3 objetos, cada uno con "name", "description", "materials", y "imagePrompt".
          El "imagePrompt" debe ser una lista de 3 a 5 palabras clave en inglés, separadas por comas, para buscar una imagen de stock (ej. "anchor, keychain, bronze, nautical, elegant").
        `
        : `
          Actúa como un director creativo en "Recuerdos Artesanales", una tienda de souvenirs personalizados.
          Un cliente ha descrito su idea o evento: "${userInput}".

          Tu tarea es generar 3 conceptos de souvenirs únicos y creativos basados en esa descripción.
          Para cada concepto, incluye un "imagePrompt": una lista de 3 a 5 palabras clave en inglés, separadas por comas, para buscar una imagen de stock (ej. "rustic, wooden, coaster, mountain, engraved").

          Debes responder únicamente con un objeto JSON que contenga una clave "concepts".
          El valor de "concepts" debe ser un array de 3 objetos.
          Cada objeto debe tener las siguientes claves: "name", "description", "materials", y "imagePrompt".

          Ejemplo de respuesta JSON:
          {
            "concepts": [
              {
                "name": "Anclas del Atardecer",
                "description": "Elegantes llaveros de bronce con forma de ancla, grabados con sus iniciales y la fecha de la boda. Un recuerdo náutico y sofisticado.",
                "materials": ["Bronce", "Grabado Láser"],
                "imagePrompt": "anchor, keychain, bronze, nautical, elegant"
              }
            ]
          }
        `;
    }

    console.log("Prompt enviado a IA:", prompt);


    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            concepts: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING },
                  description: { type: SchemaType.STRING },
                  materials: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                  imagePrompt: { type: SchemaType.STRING },
                },
                required: ["name", "description", "materials", "imagePrompt"],
              },
            },
          },
          required: ["concepts"],
        },
      },
    });

    let jsonStr = result.response.text();

    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: jsonStr,
    };

  } catch (error) {
    console.error("Error in Netlify function:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Failed to generate concept: ${errorMessage}` }),
    };
  }
};

export { handler };