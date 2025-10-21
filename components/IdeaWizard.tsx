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

const IdeaWizard: React.FC<IdeaWizardProps> = ({ eventTypes, onConceptsUpdate, isLoading, setIsLoading, companySettings }) => {
    const [step, setStep] = useState(1);
    const [selections, setSelections] = useState({ event: '', style: '' });
    const [details, setDetails] = useState('');
    const [jobId, setJobId] = useState<string | null>(null);

    // Efecto para escuchar cambios en Firestore cuando hay un jobId
    useEffect(() => {
        if (!jobId) return;

        const unsub = onSnapshot(doc(db, "conceptJobs", jobId), (doc) => {
            const jobData = doc.data();
            if (jobData && jobData.concepts) {
                onConceptsUpdate(jobData.concepts); // Actualiza el estado en el componente padre

                // Opcional: si todas las imágenes están listas, deja de escuchar
                const allDone = jobData.concepts.every((c: SouvenirConcept) => !c.isGeneratingImage);
                if (allDone) {
                    unsub();
                    setJobId(null);
                }
            }
        });

        // Cleanup: deja de escuchar si el componente se desmonta
        return () => unsub();
    }, [jobId, onConceptsUpdate]);

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
            const response = await fetch('/.netlify/functions/generateConcepts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userInput, companySettings }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate concepts');
            }

            const data = await response.json();
            
            // Guarda el Job ID para empezar a escuchar y actualiza los conceptos iniciales
            if (data.jobId && data.concepts) {
                onConceptsUpdate(data.concepts);
                setJobId(data.jobId);
            }

        } catch (error) {
            console.error("Error submitting idea:", error);
            // Aquí podrías manejar el error en la UI
        } finally {
            setIsLoading(false); // El loading principal termina, las tarjetas tienen su propio estado
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
                                <button key={event.name} onClick={() => handleSelect('event', event.name)} className="p-4 border rounded-lg flex flex-col items-center justify-center hover:bg-gray-100 transition-colors">
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
                                <button key={style.name} onClick={() => handleSelect('style', style.name)} className="p-4 border rounded-lg flex flex-col items-center justify-center hover:bg-gray-100 transition-colors">
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
                                className="w-full p-4 rounded-lg border-2 border-gray-300 focus:ring-2 transition duration-300 resize-none"
                                style={{ color: 'var(--brand-text)', borderColor: 'var(--brand-primary)', boxShadow: '0 0 0 2px var(--brand-primary)' }}
                                placeholder={`Para mi ${selections.event.toLowerCase()} de estilo ${selections.style.toLowerCase()}, me gustaría...`}
                                rows={4}
                            />
                            <div className="flex justify-between items-center mt-4">
                                <button type="button" onClick={handleBack} className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.7 }}>Volver</button>
                                <button type="submit" disabled={isLoading} className="px-8 py-3 border border-transparent text-lg font-bold rounded-md text-white disabled:opacity-50" style={{ background: 'var(--brand-primary)' }}>
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
    <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl mx-auto" style={{ color: 'var(--brand-text)' }}>
            {step > 1 && renderSelections()}
            {renderStep()}
        </div>
    );
};

export default IdeaWizard;