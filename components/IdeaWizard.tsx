import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { SouvenirConcept } from '../types';
import { Company } from '../types/company';
import { useTranslation } from 'react-i18next';

export interface CategoryOption {
    name: string;
    icon: string;
}

interface IdeaWizardProps {
    eventTypes: CategoryOption[];
    onConceptsUpdate: (concepts: SouvenirConcept[]) => void;
    onSearchStart: () => void;
    isLoading: boolean;
    setIsLoading: (isLoading: boolean) => void;
    companySettings?: Company['settings'];
}

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

const IdeaWizard: React.FC<IdeaWizardProps> = ({ eventTypes, onConceptsUpdate, onSearchStart, isLoading, setIsLoading, companySettings }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState(1);
    const [selections, setSelections] = useState({ event: '', style: '' });
    const [details, setDetails] = useState('');
    const [jobId, setJobId] = useState<string | null>(null);

    useEffect(() => {
        if (!jobId) return;

        const unsub = onSnapshot(doc(db, "conceptJobs", jobId), (doc) => {
            const jobData = doc.data();

            if (jobData) {
                if (jobData.concepts) {
                    onConceptsUpdate(jobData.concepts);
                }

                const isJobDone = jobData.status === 'completed' || jobData.status === 'failed';
                const areAllImagesLoaded = jobData.concepts?.every((c: SouvenirConcept) => c.imageUrl || c.error) ?? false;

                if (isJobDone) {
                    if (areAllImagesLoaded || jobData.status === 'failed') {
                        setIsLoading(false);
                        unsub();
                        setJobId(null);
                    }
                }
            }
        });

        return () => {
            unsub();
        };
    }, [jobId, onConceptsUpdate, setIsLoading]);

    const handleSelect = (type: 'event' | 'style', value: string) => {
        setSelections(prev => ({ ...prev, [type]: value }));
        setStep(step + 1);
    };

    const handleBack = () => {
        setStep(step - 1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        onConceptsUpdate([]);

        const userInput = `Evento: ${selections.event}, Estilo: ${t(`ideaWizard.styles.${selections.style}`)}, Detalles: ${details}`;
        
        try {
            const response = await fetch('/.netlify/functions/start-concept-generation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userInput, companySettings }),
            });

            if (response.status !== 202) {
                throw new Error('Failed to start concept generation process');
            }

            const data = await response.json();
            
            if (data.jobId) {
                setJobId(data.jobId);
                onSearchStart();
            } else {
                throw new Error('Did not receive a job ID.');
            }

        } catch (error) {
            console.error("Error submitting idea:", error);
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
                                className="w-full p-4 bg-white rounded-lg border-2 border-gray-300 focus:border-transparent focus:ring-2 focus:ring-[var(--brand-primary)] transition duration-300 resize-none"
                                style={{ color: 'var(--brand-text)' }}
                                placeholder={t('ideaWizard.step3.placeholder', { event: selections.event.toLowerCase(), style: t(`ideaWizard.styles.${selections.style}`).toLowerCase() })}
                                rows={4}
                            />
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
