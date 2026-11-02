import type { Handler } from "@netlify/functions";
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { consumeAiGeneration } from '../lib/ai-usage';
import { getFirebaseAdmin } from '../lib/firebase-admin';
import { getBearerToken, verifyIdToken } from '../lib/verify-id-token';

const GENERATION_ALLOWED_STATUSES = ['APPROVED', 'ACTIVE'];
const MAX_USER_INPUT_LENGTH = 2000;
const MAX_BASE_CONCEPT_BYTES = 10 * 1024;

const isValidBaseConcept = (baseConcept: unknown) =>
  baseConcept === undefined ||
  (typeof baseConcept === 'object' &&
    baseConcept !== null &&
    !Array.isArray(baseConcept) &&
    Buffer.byteLength(JSON.stringify(baseConcept)) <= MAX_BASE_CONCEPT_BYTES);

const jsonResponse = (statusCode: number, body: object, headers: Record<string, string> = {}) => ({
  statusCode,
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  let body: { userInput?: unknown; baseConcept?: unknown; companyId?: unknown };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const idToken = getBearerToken(event.headers);
  if (!idToken) {
    return jsonResponse(401, { error: "Authentication required." });
  }

  let firebase: ReturnType<typeof getFirebaseAdmin>;
  let db: FirebaseFirestore.Firestore;
  try {
    firebase = getFirebaseAdmin();
    db = firebase.firestore();
  } catch (error) {
    console.error('Could not initialize Firebase Admin SDK:', (error as Error).message);
    return jsonResponse(500, { error: "Internal server configuration error." });
  }

  const uid = await verifyIdToken(idToken, firebase.auth());
  if (!uid) {
    return jsonResponse(401, { error: "Authentication required." });
  }

  const { companyId, userInput, baseConcept } = body;
  // Una "/" apuntaría a otra ruta de Firestore en lugar de a un documento de `companies`.
  if (typeof companyId !== 'string' || !companyId.trim() || companyId.includes('/')) {
    return jsonResponse(400, { error: "Missing 'companyId' in request body." });
  }

  if (typeof userInput !== 'string' || !userInput.trim() || userInput.length > MAX_USER_INPUT_LENGTH) {
    return jsonResponse(400, { error: `'userInput' must be a non-empty string of at most ${MAX_USER_INPUT_LENGTH} characters.` });
  }

  if (!isValidBaseConcept(baseConcept)) {
    return jsonResponse(400, { error: `'baseConcept' must be an object of at most ${MAX_BASE_CONCEPT_BYTES} bytes.` });
  }

  const jobId = uuidv4();
  let jobCreated = false;

  try {
    const companySnapshot = await db.collection('companies').doc(companyId).get();
    if (!companySnapshot.exists) {
      return jsonResponse(404, { error: "Company not found." });
    }

    const company = companySnapshot.data() ?? {};
    if (!GENERATION_ALLOWED_STATUSES.includes(company.status) || company.settings?.enableAIAssistant !== true) {
      return jsonResponse(403, { error: "AI generation is not enabled for this company." });
    }

    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (!internalApiKey) {
      console.error("INTERNAL_API_KEY is not set. Cannot invoke background function securely.");
      return jsonResponse(500, { error: "Internal server configuration error." });
    }

    const usage = await consumeAiGeneration(db, uid);
    if (!usage.allowed) {
      return jsonResponse(429, { error: "AI generation limit reached." }, { "Retry-After": String(usage.retryAfterSeconds) });
    }

    // Create a placeholder job document in Firestore so the frontend can start polling.
    await db.collection('conceptJobs').doc(jobId).set({
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      concepts: [], // Start with an empty array
    });
    jobCreated = true;

    // Netlify garantiza URL en tiempo de ejecución, pero no necesariamente DEPLOY_URL:
    // sin ella, un deploy preview llamaría a la función de fondo de producción.
    const functionUrl = `${process.env.DEPLOY_URL || process.env.URL}/.netlify/functions/generate-concepts-background`;

    // Asynchronously invoke the background function. We now await the fetch to ensure it's dispatched.
    const backgroundResponse = await fetch(functionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': internalApiKey
        },
        body: JSON.stringify({
            jobId,
            userInput,
            baseConcept,
            // Los ajustes salen de Firestore: nunca de lo que mande el navegador.
            companySettings: {
              name: company.name,
              aiPrompt: company.settings?.aiPrompt,
              imageProvider: company.settings?.imageProvider,
            },
        }),
    });
    // node-fetch no lanza con respuestas no 2xx.
    if (!backgroundResponse.ok) {
      throw new Error(`Background function responded with HTTP ${backgroundResponse.status}.`);
    }

    // Immediately return the job ID to the client.
    return jsonResponse(202, { jobId }); // 202 Accepted: The request has been accepted for processing.

  } catch (error) {
    console.error(`Error in start-concept-generation for job ${jobId}:`, error);
    // Attempt to update the job status to failed if something goes wrong here.
    if (jobCreated) {
      await db.collection('conceptJobs').doc(jobId).set({
          status: 'failed',
          error: 'Failed to start the generation process.',
      }, { merge: true }).catch(console.error);
    }

    return jsonResponse(500, { error: "Failed to start concept generation." });
  }
};
