import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase'; // Asegúrate que la ruta sea correcta
import { SouvenirConcept } from '../types'; // Asumo que tienes un archivo de tipos
import { Company } from '../types/company';

export interface CategoryOption {
    name: string;
    icon: string;
}

interface IdeaWizardProps {
    eventTypes: CategoryOption[];
    onConceptsUpdate: (concepts: SouvenirConcept[]) => void; // Para pasar los conceptos al padre
    onSearchStart: () => void; // Para notificar al padre que la búsqueda ha comenzado
    isLoading: boolean;
    setIsLoading: (isLoading: boolean) => void;
    companySettings?: Company['settings'];
}

const styles = [
    { name: 'Formal', icon: '🎩' },
    { name: 'Clásico', icon: '🏛️' },
    { name: 'Moderno', icon: '✨' },
    { name: 'Vintage', icon: '📜' },
    { name: 'Sofisticado', icon: '💎' },
    { name: 'Rústico', icon: '🌿' },
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
    const [step, setStep] = useState(1);
    const [selections, setSelections] = useState({ event: '', style: '' });
    const [details, setDetails] = useState('');
    const [jobId, setJobId] = useState<string | null>(null);

    // Efecto para escuchar cambios en Firestore cuando hay un jobId
    useEffect(() => {
        if (!jobId) return;

        console.log(`[IdeaWizard] Subscribing to Firestore updates for job: ${jobId}`);

        const unsub = onSnapshot(doc(db, "conceptJobs", jobId), (doc) => {
            console.log(`[IdeaWizard] Received update for job: ${jobId}`, doc.data());
            const jobData = doc.data();

            if (jobData) {
                // Siempre pasa los conceptos al padre para que él decida cómo renderizar
                if (jobData.concepts) {
                    onConceptsUpdate(jobData.concepts);
                    console.log("[IdeaWizard] Concepts updated in parent component.");
                }

                // Define las condiciones de finalización de forma más robusta
                const isJobDone = jobData.status === 'completed' || jobData.status === 'failed';
                const areAllImagesLoaded = jobData.concepts?.every((c: SouvenirConcept) => c.imageUrl || c.error) ?? false;

                if (isJobDone) {
                    if (areAllImagesLoaded || jobData.status === 'failed') {
                        console.log(`[IdeaWizard] Job ${jobId} finished and all data is accounted for. Unsubscribing.`);
                        setIsLoading(false);
                        unsub();
                        setJobId(null); // Limpia el jobId para evitar re-suscripciones
                    } else {
                        console.log(`[IdeaWizard] Job ${jobId} is 'completed', but waiting for all image URLs to arrive before unsubscribing.`);
                    }
                }
            }
        });

        // Cleanup: deja de escuchar si el componente se desmonta
        return () => {
            console.log(`[IdeaWizard] Unsubscribing from job: ${jobId}`);
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
        onConceptsUpdate([]); // Limpia los conceptos anteriores

        const userInput = `Evento: ${selections.event}, Estilo: ${selections.style}, Detalles: ${details}`;
        
        try {
            // Llama a la nueva función síncrona que inicia el proceso
            const response = await fetch('/.netlify/functions/start-concept-generation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userInput, companySettings }),
            });

            if (response.status !== 202) { // Esperamos un 202 Accepted
                throw new Error('Failed to start concept generation process');
            }

            const data = await response.json();
            
            // Guarda el Job ID para empezar a escuchar. Los conceptos llegarán a través del listener.
            if (data.jobId) {
                setJobId(data.jobId);
                onSearchStart(); // Notifica al padre que la búsqueda ha comenzado
            } else {
                throw new Error('Did not receive a job ID.');
            }

        } catch (error) {
            console.error("Error submitting idea:", error);
            setIsLoading(false); // Asegúrate de detener el loading en caso de error
            // Aquí podrías manejar el error en la UI
        }
        // No cambies setIsLoading a false aquí. El listener se encargará de la UI.
        // El estado de carga global se puede desactivar, pero las tarjetas mostrarán su propio estado.
        // Lo movemos al `finally` para un mejor control.
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
                        <span className="text-2xl mr-2">{styles.find(s => s.name === selections.style)?.icon}</span>
                        <span className="font-semibold" style={{ color: 'var(--brand-text)' }}>{selections.style}</span>
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
                        <h2 className="text-2xl font-serif text-center mb-6" style={{ color: 'var(--brand-text)' }}>¿Qué tipo de evento es?</h2>
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
                        <h2 className="text-2xl font-serif text-center mb-6" style={{ color: 'var(--brand-text)' }}>¿Cuál es el estilo que buscas?</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {styles.map(style => (
                                <button key={style.name} onClick={() => handleSelect('style', style.name)} className="p-4 bg-white rounded-xl flex flex-col items-center justify-center border-2 border-gray-200 hover:border-slate-400 transition-colors duration-300">
                                    <span className="text-4xl mb-2">{style.icon}</span>
                                    <span className="font-semibold" style={{ color: 'var(--brand-text)' }}>{style.name}</span>
                                </button>
                            ))}
                        </div>
                        <div className="text-center mt-6">
                            <button onClick={handleBack} className="text-sm text-gray-600 hover:underline">Volver</button>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div>
                        <h2 className="text-2xl font-serif text-center mb-6" style={{ color: 'var(--brand-text)' }}>Añade más detalles</h2>
                        <form onSubmit={handleSubmit}>
                            <textarea
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                className="w-full p-4 bg-white rounded-lg border-2 border-gray-300 focus:border-transparent focus:ring-2 focus:ring-[var(--brand-primary)] transition duration-300 resize-none"
                                style={{ color: 'var(--brand-text)' }}
                                placeholder={`Para mi ${selections.event.toLowerCase()} de estilo ${selections.style.toLowerCase()}, me gustaría...`}
                                rows={4}
                            />
                            <div className="flex justify-between items-center mt-4">
                                <button type="button" onClick={handleBack} className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.7 }}>Volver</button>
                                <button type="submit" disabled={isLoading} className="px-8 py-3 border border-transparent text-lg font-bold rounded-md text-white disabled:opacity-50 hover:opacity-90 transition-opacity" style={{ background: 'var(--brand-primary)' }}>
                                    {isLoading ? 'Generando...' : 'Generar Ideas'}
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
                    <h1 className="text-3xl font-serif" style={{ color: 'var(--brand-primary)' }}>Generador de Ideas</h1>
                    <p className="text-slate-600 mt-2">Encuentra el recuerdo perfecto en 3 simples pasos.</p>
                </div>
                {step > 1 && renderSelections()}
                {renderStep()}
            </div>
        </div>
    );
};

export default IdeaWizard;