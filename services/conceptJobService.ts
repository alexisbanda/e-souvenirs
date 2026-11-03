import { doc, onSnapshot } from 'firebase/firestore';
import { SouvenirConcept } from '../types';
import { auth, db } from './firebase';

// Una función de fondo de Netlify vive hasta 15 minutos, pero escribe en el job al
// terminar cada paso: tanto tiempo sin novedades significa que ya no va a terminar.
export const CONCEPT_JOB_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export type ConceptGenerationFailure = 'login' | 'forbidden' | 'rateLimited' | 'companyRateLimited' | 'generic';

export type ConceptGenerationResult =
    | { ok: true; jobId: string }
    | { ok: false; reason: ConceptGenerationFailure };

/**
 * Pide una generación a la función, con el ID token del usuario. Sin sesión no
 * llega a llamarla. Los ajustes de la empresa los lee el servidor de Firestore.
 */
export const startConceptGeneration = async (
    payload: { companyId: string; userInput: string; baseConcept?: unknown },
): Promise<ConceptGenerationResult> => {
    const user = auth.currentUser;
    if (!user) {
        return { ok: false, reason: 'login' };
    }

    try {
        const idToken = await user.getIdToken();
        const response = await fetch('/.netlify/functions/start-concept-generation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify(payload),
        });

        if (response.status === 401) return { ok: false, reason: 'login' };
        if (response.status === 403) return { ok: false, reason: 'forbidden' };
        if (response.status === 429) {
            const { scope } = await response.json().catch(() => ({ scope: undefined }));
            return { ok: false, reason: scope === 'company' ? 'companyRateLimited' : 'rateLimited' };
        }
        if (response.status !== 202) {
            throw new Error(`Unexpected status ${response.status}`);
        }

        const { jobId } = await response.json();
        if (!jobId) {
            throw new Error('Did not receive a job ID.');
        }
        return { ok: true, jobId };
    } catch (error) {
        console.error('Error starting concept generation:', error);
        return { ok: false, reason: 'generic' };
    }
};

/**
 * Sigue un job de conceptos hasta que termina. Devuelve la función que cancela
 * la suscripción; al terminar se cancela sola. Un error del listener o un job que
 * deja de avanzar terminan como `failed`, para no dejar la pantalla bloqueada.
 */
export const subscribeToConceptJob = (
    jobId: string,
    onConcepts: (concepts: SouvenirConcept[]) => void,
    onDone: (status: 'completed' | 'failed', concepts: SouvenirConcept[]) => void,
) => {
    let lastConcepts: SouvenirConcept[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsub = () => {};

    const stop = () => {
        clearTimeout(timer);
        unsub();
    };
    const finish = (status: 'completed' | 'failed') => {
        stop();
        // Un job que termina sin conceptos no ha dado nada que mostrar: es un fallo.
        onDone(lastConcepts.length > 0 ? status : 'failed', lastConcepts);
    };
    const restartTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            console.error(`Concept job ${jobId} stopped making progress.`);
            finish('failed');
        }, CONCEPT_JOB_INACTIVITY_TIMEOUT_MS);
    };

    restartTimer();
    unsub = onSnapshot(
        doc(db, "conceptJobs", jobId),
        (snapshot) => {
            const jobData = snapshot.data();

            if (jobData) {
                restartTimer();

                if (jobData.concepts) {
                    lastConcepts = jobData.concepts;
                    onConcepts(jobData.concepts);
                }

                // `completed` es la última escritura del job: no llegará otro snapshot,
                // aunque algún concepto se haya quedado sin imagen.
                if (jobData.status === 'completed' || jobData.status === 'failed') {
                    finish(jobData.status);
                }
            }
        },
        (error) => {
            console.error(`Could not follow concept job ${jobId}:`, error);
            finish('failed');
        },
    );
    return stop;
};
