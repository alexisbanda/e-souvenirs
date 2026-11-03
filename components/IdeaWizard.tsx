import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { SouvenirConcept } from '../types';
import { useTranslation } from 'react-i18next';

export interface CategoryOption {
    name: string;
    icon: string;
}

interface IdeaWizardProps {
    eventTypes: CategoryOption[];
    onConceptsUpdate: (concepts: SouvenirConcept[]) => void;
    onSearchStart: () => void;
    onSearchEnd: () => void;
    isLoading: boolean;
    setIsLoading: (isLoading: boolean) => void;
    companyId: string;
    companySlug: string;
}

// El servidor admite 2000 caracteres en userInput: deja margen para evento y estilo.
const MAX_DETAILS_LENGTH = 1500;

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
        onDone(status, lastConcepts);
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

const styleOptions = [
    { key: 'formal', icon: '🎩' },
    { key: 'classic', icon: '🏛️' },
    { key: 'modern', icon: '✨' },
    { key: 'vintage', icon: '📜' },
    { key: 'sophisticated', icon: '💎' },
    { key: 'rustic', icon: '🌿' },
];

const ProgressBar: React.FC<{ currentStep: number, totalSteps: number }> = ({ currentStep, totalSteps }) => {
    const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;
    return (
        <div className="w-full bg-slate-200 h-1">
            <div
                className="h-1 transition-all duration-500"
                style={{ width: `${progressPercentage}%`, backgroundColor: 'var(--brand-primary)' }}
            ></div>
        </div>
    );
};

const IdeaWizard: React.FC<IdeaWizardProps> = ({ eventTypes, onConceptsUpdate, onSearchStart, onSearchEnd, isLoading, setIsLoading, companyId, companySlug }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState(1);
    const [selections, setSelections] = useState({ event: '', style: '' });
    const [details, setDetails] = useState('');
    const [jobId, setJobId] = useState<string | null>(null);
    const [failure, setFailure] = useState<ConceptGenerationFailure | 'generationFailed' | null>(null);

    useEffect(() => {
        if (!jobId) return;

        return subscribeToConceptJob(jobId, onConceptsUpdate, (status) => {
            setIsLoading(false);
            setJobId(null);
            onSearchEnd();
            if (status === 'failed') {
                setFailure('generationFailed');
            }
        });
    }, [jobId, onConceptsUpdate, onSearchEnd, setIsLoading]);

    const handleSelect = (type: 'event' | 'style', value: string) => {
        setSelections(prev => ({ ...prev, [type]: value }));
        setStep(step + 1);
    };

    const handleBack = () => {
        setStep(step - 1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;
        setFailure(null);

        const userInput = `Evento: ${selections.event}, Estilo: ${t(`ideaWizard.styles.${selections.style}`)}, Detalles: ${details}`;

        setIsLoading(true);
        const result = await startConceptGeneration({ companyId, userInput });

        if (result.ok) {
            onConceptsUpdate([]);
            setJobId(result.jobId);
            onSearchStart();
        } else {
            setFailure(result.reason);
            setIsLoading(false);
        }
    };

    const renderSelections = () => (
        <div className="flex justify-center items-center mb-4 text-center">
            {selections.event && (
                <div className="flex items-center mx-2">
                    <span className="text-2xl mr-2">{eventTypes.find(e => e.name === selections.event)?.icon}</span>
                    <span className="font-semibold" style={{ color: 'var(--brand-text)' }}>{selections.event}</span>
                </div>
            )}
            {selections.style && (
                <>
                    <span className="mx-2" style={{ color: 'var(--brand-text)', opacity: 0.5 }}>+</span>
                    <div className="flex items-center mx-2">
                        <span className="text-2xl mr-2">{styleOptions.find(s => s.key === selections.style)?.icon}</span>
                        <span className="font-semibold" style={{ color: 'var(--brand-text)' }}>{t(`ideaWizard.styles.${selections.style}`)}</span>
                    </div>
                </>
            )}
        </div>
    );

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div>
                        <h2 className="text-2xl font-serif text-center mb-6" style={{ color: 'var(--brand-text)' }}>{t('ideaWizard.step1.title')}</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {eventTypes.map(event => (
                                <button key={event.name} onClick={() => handleSelect('event', event.name)} className="p-4 bg-white rounded-xl flex flex-col items-center justify-center border-2 border-gray-200 hover:border-slate-400 transition-colors duration-300">
                                    <span className="text-4xl mb-2">{event.icon}</span>
                                    <span className="font-semibold" style={{ color: 'var(--brand-text)' }}>{event.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div>
                        <h2 className="text-2xl font-serif text-center mb-6" style={{ color: 'var(--brand-text)' }}>{t('ideaWizard.step2.title')}</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {styleOptions.map(style => (
                                <button key={style.key} onClick={() => handleSelect('style', style.key)} className="p-4 bg-white rounded-xl flex flex-col items-center justify-center border-2 border-gray-200 hover:border-slate-400 transition-colors duration-300">
                                    <span className="text-4xl mb-2">{style.icon}</span>
                                    <span className="font-semibold" style={{ color: 'var(--brand-text)' }}>{t(`ideaWizard.styles.${style.key}`)}</span>
                                </button>
                            ))}
                        </div>
                        <div className="text-center mt-6">
                            <button onClick={handleBack} className="text-sm text-gray-600 hover:underline">{t('ideaWizard.buttons.back')}</button>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div>
                        <h2 className="text-2xl font-serif text-center mb-6" style={{ color: 'var(--brand-text)' }}>{t('ideaWizard.step3.title')}</h2>
                        <form onSubmit={handleSubmit}>
                            <textarea
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                maxLength={MAX_DETAILS_LENGTH}
                                className="w-full p-4 bg-white rounded-lg border-2 border-gray-300 focus:border-transparent focus:ring-2 focus:ring-[var(--brand-primary)] transition duration-300 resize-none"
                                style={{ color: 'var(--brand-text)' }}
                                placeholder={t('ideaWizard.step3.placeholder', { event: selections.event.toLowerCase(), style: t(`ideaWizard.styles.${selections.style}`).toLowerCase() })}
                                rows={4}
                            />
                            {failure && (
                                <p role="alert" className="mt-3 text-sm text-red-600">
                                    {t(`ideaWizard.errors.${failure}`)}
                                    {failure === 'login' && (
                                        <>
                                            {' '}
                                            <Link to={`/${companySlug}/login`} className="font-semibold underline">{t('ideaWizard.errors.loginLink')}</Link>
                                        </>
                                    )}
                                </p>
                            )}
                            <div className="flex justify-between items-center mt-4">
                                <button type="button" onClick={handleBack} className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.7 }}>{t('ideaWizard.buttons.back')}</button>
                                <button type="submit" disabled={isLoading} className="px-8 py-3 border border-transparent text-lg font-bold rounded-md text-white disabled:opacity-50 hover:opacity-90 transition-opacity" style={{ background: 'var(--brand-primary)' }}>
                                    {isLoading ? t('ideaWizard.buttons.generating') : t('ideaWizard.buttons.generate')}
                                </button>
                            </div>
                        </form>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="bg-slate-50 rounded-2xl shadow-lg max-w-2xl mx-auto border overflow-hidden" style={{ color: 'var(--brand-text)' }}>
            <ProgressBar currentStep={step} totalSteps={3} />
            <div className="p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-serif" style={{ color: 'var(--brand-primary)' }}>{t('ideaWizard.main.title')}</h1>
                    <p className="text-slate-600 mt-2">{t('ideaWizard.main.subtitle')}</p>
                </div>
                {step > 1 && renderSelections()}
                {renderStep()}
            </div>
        </div>
    );
};

export default IdeaWizard;
