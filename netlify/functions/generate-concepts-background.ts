import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from 'pexels';
import { PredictionServiceClient, helpers } from '@google-cloud/aiplatform';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { PassThrough } from 'stream';
import sharp from 'sharp';

// --- Firebase Admin Initialization ---
// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    throw new Error('CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey);

    // The private key inside the JSON might have escaped newlines. Replace them.
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.GCS_BUCKET_NAME, // Also ensure bucket name is available here
    });
    console.log("Firebase Admin SDK initialized successfully via service account key.");

  } catch (e) {
    console.error('CRITICAL: Failed to parse or use FIREBASE_SERVICE_ACCOUNT_KEY. Ensure it is a valid, single-line JSON string in your environment variables.', e);
    // Throw an error to stop execution and provide a clear log message.
    throw new Error('Could not initialize Firebase Admin SDK. Check the logs for details.');
  }
}

// --- Google Cloud Clients Initialization ---
const location = 'us-central1';
const publisher = 'google';
const model = 'imagen-4.0-fast-generate-001'; // Imagen 4

const bucketName = process.env.GCS_BUCKET_NAME || '';

// Initialize Vertex AI Client
const clientOptions = {
  apiEndpoint: "us-central1-aiplatform.googleapis.com",
  credentials: {
    client_email: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!).client_email,
    private_key: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!).private_key.replace(/\\n/g, '\n'),
  }
};
const predictionServiceClient = new PredictionServiceClient(clientOptions);

// Define the expected structure of the incoming request body
interface RequestBody {
  userInput: string;
  baseConcept?: SouvenirConcept;
  companySettings?: {
    aiPrompt?: string;
    name?: string;
    imageProvider?: 'PEXELS' | 'GOOGLE_IMAGEN';
  };
}

// Define the structure of the successful response body
export interface SouvenirConcept {
  id: string;
  name: string;
  description: string;
  materials: string[];
  imagePrompt: string;
  imageUrl: string | null;
  isGeneratingImage: boolean;
}

const db = admin.firestore();

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const body = JSON.parse(event.body || "{}");
  const jobId = body.jobId; // Extraer jobId al principio para usarlo en el logging de errores

  console.log(`[Handler] Starting for job: ${jobId}.`);

  if (event.httpMethod !== "POST") {
    console.error(`[Handler] Job ${jobId}: Method Not Allowed (405).`);
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  // Security check for internal calls
  const internalApiKey = process.env.INTERNAL_API_KEY;
  const providedApiKey = event.headers['x-internal-api-key'];

  if (!internalApiKey || providedApiKey !== internalApiKey) {
    console.warn(`[Handler] Job ${jobId}: Forbidden (403). Unauthorized attempt.`);
    return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const pexelsApiKey = process.env.PEXELS_API_KEY;

  try {
    const { userInput, baseConcept, companySettings } = body as RequestBody & { jobId: string };

    if (!jobId) {
      console.error("[Handler] Critical: Missing 'jobId' in request body.");
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'jobId' in request body." }) };
    }
    
    const imageProvider = companySettings?.imageProvider || process.env.IMAGE_PROVIDER || 'PEXELS';
    console.log(`[Handler] Job ${jobId}: Image provider is "${imageProvider}".`);

    if (!geminiApiKey) {
      throw new Error("Gemini API key is not configured.");
    }
    if (imageProvider === 'PEXELS' && !pexelsApiKey) {
      throw new Error("Pexels API key is not configured for PEXELS provider.");
    }
    if (imageProvider === 'GOOGLE_IMAGEN' && (!process.env.GCP_PROJECT_ID || !bucketName)) {
      throw new Error("Google Cloud Project ID or Bucket Name is not configured for GOOGLE_IMAGEN provider.");
    }

    console.log(`[Handler] Job ${jobId}: Received company settings:`, companySettings);
    if (!userInput) {
      throw new Error("Missing 'userInput' in request body.");
    }

    // Build the prompt for the text generation AI
    let prompt = '';
    if (companySettings?.aiPrompt) {
      let basePrompt = companySettings.aiPrompt;
      // CRITICAL: Ensure the prompt asks for a photorealistic description for the image model.
      // This is a common failure point if the custom prompt only asks for keywords.
      if (!basePrompt.includes('fotorrealista') && !basePrompt.includes('photorealistic')) {
        basePrompt += `\nPara cada concepto, el "imagePrompt" debe ser una descripción detallada en inglés para una IA generativa de imágenes. Debe ser fotorrealista y describir el producto, el fondo y el estilo. (ej. "Photorealistic product shot of a rustic wooden coaster, laser-engraved with a mountain landscape, placed on a granite countertop next to a steaming mug").`;
      }
      prompt = basePrompt
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
          El "imagePrompt" debe ser una descripción detallada en inglés para una IA generativa de imágenes. Debe ser fotorrealista y describir el producto, el fondo y el estilo. (ej. "Photorealistic product shot of a bronze anchor keychain, engraved with 'Class of 2025', on a dark wooden table").
        `
        : `
          Actúa como un director creativo en "Recuerdos Artesanales", una tienda de souvenirs personalizados.
          Un cliente ha descrito su idea o evento: "${userInput}".

          Tu tarea es generar 3 conceptos de souvenirs únicos y creativos basados en esa descripción.
          Para cada concepto, incluye un "imagePrompt": una descripción detallada en inglés para una IA generativa de imágenes. Debe ser fotorrealista y describir el producto, el fondo y el estilo. (ej. "Photorealistic product shot of a rustic wooden coaster, laser-engraved with a mountain landscape, placed on a granite countertop next to a steaming mug").

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
                "imagePrompt": "Photorealistic product shot of a bronze anchor keychain, engraved with 'Boda J&M', on a piece of driftwood on a sandy beach during sunset."
              }
            ]
          }
        `;
    }

        // --- Step 1: Generate Concepts with Gemini ---
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    console.log(`[Handler] Job ${jobId}: Generating concepts with prompt:`, prompt);

    const result = await geminiModel.generateContent({
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

    const response = result.response;
    const jsonStr = response.text();
    console.log(`[Handler] Job ${jobId}: Received JSON string from Gemini:`, jsonStr);
    let generatedData = JSON.parse(jsonStr) as { concepts: Omit<SouvenirConcept, 'id'>[] };
    console.log(`[Handler] Job ${jobId}: Parsed concepts data:`, generatedData);

    // --- Step 2: Prepare Concepts and Update Job ---
    const conceptsWithIds: SouvenirConcept[] = generatedData.concepts.map(concept => ({
      ...concept,
      id: uuidv4(),
      isGeneratingImage: true,
      imageUrl: null,
    }));

    // Update the existing job document in Firestore with the generated concepts
    const jobRef = db.collection('conceptJobs').doc(jobId);
    console.log(`[Handler] Job ${jobId}: Updating Firestore with initial concepts...`);
    await jobRef.update({
      status: 'processing',
      concepts: conceptsWithIds,
    });
    console.log(`[Handler] Job ${jobId}: Firestore updated successfully with concepts.`);

    // --- Step 3: Generate Images in the Background ---
    console.log(`[Handler] Job ${jobId}: Starting image generation for ${conceptsWithIds.length} concepts.`);
    const imageGenerationPromises = conceptsWithIds.map(concept => {
      if (imageProvider === 'GOOGLE_IMAGEN') {
        console.log(`[Handler] Job ${jobId}: Calling generateImageWithImagen for concept "${concept.name}".`);
        return generateImageWithImagen(jobId, concept);
      } else {
        console.log(`[Handler] Job ${jobId}: Calling fetchImageFromPexels for concept "${concept.name}".`);
        return fetchImageFromPexels(jobId, concept);
      }
    });

    await Promise.all(imageGenerationPromises);

    // --- Step 4: Finalize Job ---
    console.log(`[Handler] Job ${jobId}: All image processing finished. Finalizing job.`);
    await jobRef.update({ status: 'completed' });

    console.log(`[Handler] Job ${jobId}: Completed successfully.`);

    // Background functions don't need to return data to the original caller,
    // but a success status indicates it finished.
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Job ${jobId} processed successfully.` }),
    };

  } catch (error) {
    console.error(`[Handler] Job ${jobId}: Error in handler:`, error);
    if (jobId) {
      try {
        await db.collection('conceptJobs').doc(jobId).update({
          status: 'failed',
          error: error instanceof Error ? error.message : "An unknown error occurred during background processing.",
        });
        console.log(`[Handler] Job ${jobId}: Marked job as 'failed' in Firestore.`);
      } catch (dbError) {
        console.error(`[Handler] Job ${jobId}: CRITICAL - Failed to mark job as 'failed' in Firestore after another error.`, dbError);
      }
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Failed to generate concept: ${errorMessage}` }),
    };
  }
};

async function updateConceptInJob(jobId: string, conceptId: string, updatedData: Partial<SouvenirConcept>) {
  const jobRef = db.collection('conceptJobs').doc(jobId);
  console.log(`[UpdateConcept] Job ${jobId}, Concept ${conceptId}: Attempting to update with data:`, updatedData);
  try {
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
      throw new Error(`Job ${jobId} not found`);
    }

    const jobData = jobDoc.data() as { concepts: SouvenirConcept[] };
    const concepts = jobData.concepts;
    const conceptIndex = concepts.findIndex(c => c.id === conceptId);

    if (conceptIndex === -1) {
      throw new Error(`Concept ${conceptId} not found in job ${jobId}`);
    }

    // Merge new data into the specific concept
    concepts[conceptIndex] = { ...concepts[conceptIndex], ...updatedData };

    // Update the entire concepts array in the document
    await jobRef.update({ concepts });
    console.log(`[UpdateConcept] Job ${jobId}, Concept ${conceptId}: Firestore updated successfully.`);

  } catch (error) {
    console.error(`[UpdateConcept] Job ${jobId}, Concept ${conceptId}: Failed to update Firestore.`, error);
  }
}


async function fetchImageFromPexels(jobId: string, concept: SouvenirConcept): Promise<void> {
  const conceptId = concept.id;
  const imagePrompt = concept.imagePrompt;
  console.log(`[Pexels] Job ${jobId}, Concept ${conceptId}: Fetching image with prompt: "${imagePrompt}"`);
  let imageUrl: string | undefined;
  try {
    if (!imagePrompt) {
      throw new Error("Concept is missing an imagePrompt.");
    }

    const pexelsClient = createClient(process.env.PEXELS_API_KEY!);
    const imageResult = await pexelsClient.photos.search({ query: imagePrompt, per_page: 1 });
    
    if ('photos' in imageResult && imageResult.photos.length > 0) {
      imageUrl = imageResult.photos[0].src.large;
      console.log(`[Pexels] Job ${jobId}, Concept ${conceptId}: Found image URL: ${imageUrl}`);
    } else {
      console.warn(`[Pexels] Job ${jobId}, Concept ${conceptId}: No image found on Pexels for prompt.`);
    }
  } catch (imageError) {
    console.error(`[Pexels] Job ${jobId}, Concept ${conceptId}: Failed to fetch image.`, imageError);
  } finally {
    console.log(`[Pexels] Job ${jobId}, Concept ${conceptId}: Finalizing with imageUrl: ${imageUrl}`);
    await updateConceptInJob(jobId, conceptId, { imageUrl: imageUrl || null, isGeneratingImage: false });
  }
}

async function generateImageWithImagen(jobId: string, concept: SouvenirConcept): Promise<void> {
  let imageUrl: string | undefined;
  const imagePrompt = concept.imagePrompt;
  const conceptId = concept.id;
  console.log(`[Imagen] Job ${jobId}, Concept ${conceptId}: Generating image with prompt: "${imagePrompt}"`);

  try {
    if (!imagePrompt) {
      throw new Error(`Concept ${conceptId} in job ${jobId} is missing an imagePrompt.`);
    }

    const endpoint = `projects/${process.env.GCP_PROJECT_ID}/locations/${location}/publishers/${publisher}/models/${model}`;
    
    const instance = helpers.toValue({ prompt: imagePrompt });
    const parameters = helpers.toValue({ 
        sampleCount: 1,
        height: 512,
        width: 512,
    });

    const request = {
      endpoint,
      instances: [instance],
      parameters,
    };

    console.log(`[Imagen] Job ${jobId}, Concept ${conceptId}: Sending request to Vertex AI...`);
    // The cast to `any` is a workaround for a potential type mismatch in the SDK
    const [response] = await predictionServiceClient.predict(request as any, {
      timeout: 120000, // 120 seconds
    });
    console.log(`[Imagen] Job ${jobId}, Concept ${conceptId}: Received response from Vertex AI.`);
    
    if (response.predictions && response.predictions.length > 0) {
      const prediction = helpers.fromValue(response.predictions[0] as any);
      if (prediction && typeof prediction === 'object' && 'bytesBase64Encoded' in prediction && typeof prediction.bytesBase64Encoded === 'string') {
        const base64Image = prediction.bytesBase64Encoded;
        console.log(`[Imagen] Job ${jobId}, Concept ${conceptId}: Successfully extracted base64 data.`);

        if (base64Image) {
          console.log(`[Imagen] Job ${jobId}, Concept ${conceptId}: Converting image to JPEG...`);
          const jpegBuffer = await sharp(Buffer.from(base64Image, 'base64'))
            .jpeg({ quality: 80 })
            .toBuffer();

          const fileName = `generated-images/${uuidv4()}.jpeg`;
          const bucket = admin.storage().bucket(bucketName);
          const file = bucket.file(fileName);

          console.log(`[Imagen] Job ${jobId}, Concept ${conceptId}: Uploading to GCS bucket at ${fileName}...`);
          await file.save(jpegBuffer, {
            public: true,
            metadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' },
          });
          
          imageUrl = file.publicUrl();
          console.log(`[Imagen] Job ${jobId}, Concept ${conceptId}: Successfully uploaded image to ${imageUrl}`);
        }
      } else {
        console.warn(`[Imagen] Job ${jobId}, Concept ${conceptId}: Prediction received, but 'bytesBase64Encoded' not found.`, prediction);
      }
    }
    if (!imageUrl) {
      console.warn(`[Imagen] Job ${jobId}, Concept ${conceptId}: Could not generate image. No prediction data or base64 string found.`);
    }
  } catch (imageError) {
    console.error(`[Imagen] Job ${jobId}, Concept ${conceptId}: Failed to generate and upload image.`, imageError);
  } finally {
    console.log(`[Imagen] Job ${jobId}, Concept ${conceptId}: Finalizing with imageUrl: ${imageUrl}`);
    await updateConceptInJob(jobId, conceptId, { imageUrl: imageUrl || null, isGeneratingImage: false });
  }
}

export { handler };