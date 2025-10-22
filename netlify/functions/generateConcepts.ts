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
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const pexelsApiKey = process.env.PEXELS_API_KEY;

  try {
    const { userInput, baseConcept, companySettings } = JSON.parse(event.body || "{}") as RequestBody;
    
    const imageProvider = companySettings?.imageProvider || process.env.IMAGE_PROVIDER || 'PEXELS'; // PEXELS or GOOGLE_IMAGEN

    if (!geminiApiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Gemini API key is not configured." }) };
    }
    if (imageProvider === 'PEXELS' && !pexelsApiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Pexels API key is not configured." }) };
    }
    if (imageProvider === 'GOOGLE_IMAGEN' && (!process.env.GCP_PROJECT_ID || !bucketName)) {
      return { statusCode: 500, body: JSON.stringify({ error: "Google Cloud Project ID or Bucket Name is not configured." }) };
    }

    console.log("Received company settings:", companySettings);
    if (!userInput) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'userInput' in request body." }) };
    }

    // Build the prompt for the text generation AI
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    console.log("Generating concepts with prompt:", prompt);

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

    const response = result.response;
    const jsonStr = response.text();
    let generatedData = JSON.parse(jsonStr) as { concepts: Omit<SouvenirConcept, 'id'>[] };

    // --- Step 2: Create a Job and Prepare Concepts ---
    const jobId = uuidv4();
    const conceptsWithIds: SouvenirConcept[] = generatedData.concepts.map(concept => ({
      ...concept,
      id: uuidv4(),
      isGeneratingImage: true,
      imageUrl: null,
    }));

    // Create a job document in Firestore
    const jobRef = db.collection('conceptJobs').doc(jobId);
    await jobRef.set({
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      concepts: conceptsWithIds,
    });

    // --- Step 3: Trigger Background Image Generation ---
    // This part runs in the background after the response is sent.
    context.callbackWaitsForEmptyEventLoop = false;

    conceptsWithIds.forEach(concept => {
      if (imageProvider === 'GOOGLE_IMAGEN') {
        generateImageWithImagen(jobId, concept).catch(console.error);
      } else {
        // Pexels is generally fast, but running it in the background ensures consistency.
        // You might want to adapt this if Pexels is your primary and you want instant images.
        fetchImageFromPexels(jobId, concept.id).catch(console.error);
      }
    });

    // --- Step 4: Return Immediate Response ---
    // Return the job ID and the initial concepts data.
    // The frontend will use the jobId to poll for updates.
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        jobId,
        concepts: conceptsWithIds 
      }),
    };

  } catch (error) {
    console.error("Error in generateConcepts handler:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Failed to generate concept: ${errorMessage}` }),
    };
  }
};

async function updateConceptInJob(jobId: string, conceptId: string, updatedData: Partial<SouvenirConcept>) {
  const jobRef = db.collection('conceptJobs').doc(jobId);
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

  } catch (error) {
    console.error(`Failed to update job ${jobId}:`, error);
  }
}


async function fetchImageFromPexels(jobId: string, conceptId: string): Promise<void> {
  let imageUrl: string | undefined;
  let imagePrompt = '';
  try {
    const concept = (await db.collection('conceptJobs').doc(jobId).get()).data()?.concepts.find((c: SouvenirConcept) => c.id === conceptId);
    if (!concept) throw new Error("Concept not found");
    imagePrompt = concept.imagePrompt;

    const pexelsClient = createClient(process.env.PEXELS_API_KEY!);
    const imageResult = await pexelsClient.photos.search({ query: imagePrompt, per_page: 1 });
    
    if ('photos' in imageResult && imageResult.photos.length > 0) {
      imageUrl = imageResult.photos[0].src.large;
    }
  } catch (imageError) {
    console.error(`Failed to fetch image from Pexels for prompt "${imagePrompt}":`, imageError);
  } finally {
    await updateConceptInJob(jobId, conceptId, { imageUrl: imageUrl || null, isGeneratingImage: false });
  }
}

async function generateImageWithImagen(jobId: string, concept: SouvenirConcept): Promise<void> {
  let imageUrl: string | undefined;
  const imagePrompt = concept.imagePrompt;
  const conceptId = concept.id;

  try {
    if (!imagePrompt) {
      throw new Error(`Concept ${conceptId} in job ${jobId} is missing an imagePrompt.`);
    }

    console.log(`Generating image with prompt: "${imagePrompt}"`);
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

    // The cast to `any` is a workaround for a potential type mismatch in the SDK
    const [response] = await predictionServiceClient.predict(request as any, {
      timeout: 120000, // 120 seconds
    });
    
    if (response.predictions && response.predictions.length > 0) {
      const prediction = helpers.fromValue(response.predictions[0] as any);
      if (prediction && typeof prediction === 'object' && 'bytesBase64Encoded' in prediction && typeof prediction.bytesBase64Encoded === 'string') {
        const base64Image = prediction.bytesBase64Encoded;

        if (base64Image) {
          const jpegBuffer = await sharp(Buffer.from(base64Image, 'base64'))
            .jpeg({ quality: 80 })
            .toBuffer();

          const fileName = `generated-images/${uuidv4()}.jpeg`;
          const bucket = admin.storage().bucket(bucketName);
          const file = bucket.file(fileName);

          await file.save(jpegBuffer, {
            public: true,
            metadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' },
          });
          
          imageUrl = file.publicUrl();
          console.log(`Successfully uploaded image to ${imageUrl}`);
        }
      }
    }
    if (!imageUrl) {
      console.warn(`Could not generate image for prompt: "${imagePrompt}". No prediction data found.`);
    }
  } catch (imageError) {
    console.error(`Failed to generate and upload image with Imagen for prompt "${imagePrompt}":`, imageError);
  } finally {
    // Always update the job, even if the image URL is undefined
    await updateConceptInJob(jobId, conceptId, { imageUrl: imageUrl || null, isGeneratingImage: false });
  }
}

export { handler };