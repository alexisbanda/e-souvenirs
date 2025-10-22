import type { Handler } from "@netlify/functions";
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

// --- Firebase Admin Initialization ---
// This part is duplicated but necessary for the function to be self-contained.
// In a larger project, this could be a shared utility.
if (admin.apps.length === 0) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }
  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e) {
    console.error('CRITICAL: Failed to initialize Firebase Admin SDK.', e);
    throw new Error('Could not initialize Firebase Admin SDK.');
  }
}

const db = admin.firestore();

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { userInput, baseConcept, companySettings } = JSON.parse(event.body || "{}");
  const jobId = uuidv4();
  // The URL now points to the background function
  const functionUrl = `${process.env.URL}/.netlify/functions/generate-concepts-background`;
  const internalApiKey = process.env.INTERNAL_API_KEY;

  if (!internalApiKey) {
      console.error("INTERNAL_API_KEY is not set. Cannot invoke background function securely.");
      return { statusCode: 500, body: JSON.stringify({ error: "Internal server configuration error." }) };
  }

  try {
    // Create a placeholder job document in Firestore so the frontend can start polling.
    await db.collection('conceptJobs').doc(jobId).set({
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      concepts: [], // Start with an empty array
    });

    // Asynchronously invoke the background function. We now await the fetch to ensure it's dispatched.
    await fetch(functionUrl, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-internal-api-key': internalApiKey
        },
        body: JSON.stringify({
            jobId,
            userInput,
            baseConcept,
            companySettings,
        }),
    }).catch(err => {
        // Log errors but don't block the user response.
        // The job status should be updated to 'failed' by the background function if it fails.
        console.error(`Failed to invoke background function for job ${jobId}:`, err);
        // We might want to throw here to let the outer catch block handle it
        throw new Error(`Background function invocation failed: ${err.message}`);
    });

    // Immediately return the job ID to the client.
    return {
      statusCode: 202, // 202 Accepted: The request has been accepted for processing.
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    };

  } catch (error) {
    console.error(`Error in start-concept-generation for job ${jobId}:`, error);
    // Attempt to update the job status to failed if something goes wrong here.
    await db.collection('conceptJobs').doc(jobId).set({
        status: 'failed',
        error: 'Failed to start the generation process.',
    }, { merge: true }).catch(console.error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to start concept generation." }),
    };
  }
};
