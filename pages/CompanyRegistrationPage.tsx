import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BuildingOffice2Icon, UserIcon, EnvelopeIcon, LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { createCategory } from '../services/categoryService';
import { createProduct } from '../services/productService';
import { auth, db } from '../services/firebase';
import { Company } from '../types/company';
import { AppUser } from '../types/user';
import { defaultHeroImages } from '../utils/constants';

const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

type BusinessSuggestion = {
    headline: string;
    description: string;
    targetAudience: string;
    salesObjective: string;
    welcomeMessage: string;
    aiPrompt: string;
};

const CompanyRegistrationPage: React.FC = () => {
    const [step, setStep] = useState(1);
    const [companyName, setCompanyName] = useState('');
    const [adminName, setAdminName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [seedDescription, setSeedDescription] = useState('');
    const [suggestions, setSuggestions] = useState<BusinessSuggestion[]>([]);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
    const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const getRandomImage = () => {
        const randomIndex = Math.floor(Math.random() * defaultHeroImages.length);
        return defaultHeroImages[randomIndex];
    };

    const handleGenerateSuggestions = async () => {
        setSuggestionsError(null);

        if (!companyName.trim() || !seedDescription.trim()) {
            setError('Por favor, completa el nombre de tu empresa y describe qué vendes.');
            return;
        }
        
        setError(null);
        setIsGeneratingSuggestions(true);
        setSelectedSuggestionIndex(null);

        try {
            const response = await fetch('/.netlify/functions/generate-business-descriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName, seedDescription }),
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                throw new Error(errorPayload.error || 'No pudimos generar sugerencias en este momento.');
            }

            const data = await response.json() as { options?: BusinessSuggestion[] };
            const options = data.options || [];

            if (!options.length) {
                throw new Error('No recibimos sugerencias. Inténtalo nuevamente.');
            }

            setSuggestions(options);
            setStep(2); // Avanzar al siguiente paso
        } catch (err: any) {
            console.error('Failed to generate suggestions:', err);
            setSuggestions([]);
            setSuggestionsError(err.message || 'No pudimos generar sugerencias.');
        } finally {
            setIsGeneratingSuggestions(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedSuggestionIndex === null) {
            setError('Por favor, selecciona una de las sugerencias de la IA.');
            return;
        }
        setStep(3); // Avanzar al paso de creación de cuenta
    };

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (selectedSuggestionIndex === null) {
            setError('No se ha seleccionado una sugerencia de negocio.');
            setIsLoading(false);
            return;
        }

        const selectedSuggestion = suggestions[selectedSuggestionIndex];

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await updateProfile(user, { displayName: adminName });

            const companySlug = slugify(companyName);
            const newCompany: Omit<Company, 'id'> = {
                name: companyName,
                slug: companySlug,
                description: selectedSuggestion.description,
                contact: { email, contactName: adminName },
                settings: {
                    allowCustomizations: true,
                    enableAIAssistant: true,
                    welcomeMessage: selectedSuggestion.welcomeMessage,
                    aiPrompt: selectedSuggestion.aiPrompt,
                    businessProfile: {
                        description: selectedSuggestion.description,
                        targetAudience: selectedSuggestion.targetAudience,
                        salesObjective: selectedSuggestion.salesObjective,
                        seedDescription,
                    },
                },
                status: 'PENDING',
                // @ts-ignore
                createdAt: serverTimestamp(),
                adminUid: user.uid,
            };

            const companyDocRef = await addDoc(collection(db, 'companies'), newCompany);
            const companyId = companyDocRef.id;

            const userRef = doc(db, 'users', user.uid);
            const newUser: AppUser = {
                id: user.uid,
                email,
                name: adminName,
                role: 'companyadmin',
                companyId,
                // @ts-ignore
                createdAt: serverTimestamp(),
            };
            await setDoc(userRef, newUser);

            const headlineWords = (selectedSuggestion.headline || 'Categoría Principal').split(' ');
            const categoryName = headlineWords.slice(0, 2).join(' ');
            const initialCategory = {
                name: categoryName,
                description: selectedSuggestion.description,
                companyId,
                featured: true,
                icon: '🎉',
                image: getRandomImage(),
                // @ts-ignore
                createdAt: serverTimestamp(),
            };
            await createCategory(initialCategory);

            const initialProduct = {
                name: 'Producto de ejemplo',
                description: selectedSuggestion.description,
                price: 100,
                category: categoryName,
                images: [getRandomImage()],
                isFeatured: true,
                customizationConfig: {
                    text: { label: 'Texto personalizado' },
                    color: { label: 'Color', options: ['Rojo', 'Azul', 'Verde', 'Negro', 'Blanco'] },
                    date: { label: 'Fecha especial' },
                },
                companyId,
                // @ts-ignore
                createdAt: serverTimestamp(),
            };
            await createProduct(initialProduct);

            navigate('/registration-success');
        } catch (err: any) {
            let errorMessage = 'Hubo un error al registrar la empresa. Por favor, inténtalo de nuevo.';
            if (err.code === 'auth/email-already-in-use') {
                errorMessage = 'Este correo electrónico ya está en uso.';
            } else if (err.code === 'auth/weak-password') {
                errorMessage = 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
            }
            setError(errorMessage);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                        <h2 className="text-2xl font-bold text-center mb-1">Cuéntanos sobre tu negocio</h2>
                        <p className="text-slate-400 text-center mb-6">Esta información nos ayudará a generar sugerencias personalizadas para ti.</p>
                        <div className="space-y-4">
                            <div className="relative">
                                <BuildingOffice2Icon className="w-5 h-5 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3" />
                                <input type="text" placeholder="Nombre de la empresa" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent" />
                            </div>
                            <div className="relative">
                                <textarea placeholder="Ej. Souvenirs personalizados para bodas y eventos corporativos" value={seedDescription} onChange={(e) => setSeedDescription(e.target.value)} required rows={4} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none" />
                            </div>
                        </div>
                        {error && <p className="text-sm text-red-300 mt-4 text-center">{error}</p>}
                        <button type="button" onClick={handleGenerateSuggestions} disabled={isGeneratingSuggestions || !companyName || !seedDescription} className="w-full mt-6 bg-brand-primary text-white font-bold py-3 rounded-lg hover:bg-brand-primary/90 transition-all duration-300 disabled:bg-brand-primary/50 disabled:cursor-not-allowed flex items-center justify-center">
                            {isGeneratingSuggestions ? <><svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"></svg>Generando...</> : <><SparklesIcon className="w-5 h-5 mr-2" />Generar sugerencias con IA</>}
                        </button>
                    </motion.div>
                );
            case 2:
                return (
                    <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                        <h2 className="text-2xl font-bold text-center mb-1">¡Excelentes Noticias!</h2>
                        <p className="text-slate-400 text-center mb-6">Hemos generado algunas ideas para tu negocio. Elige la que más te guste.</p>
                        {suggestionsError && <p className="text-sm text-red-300 mb-4 text-center">{suggestionsError}</p>}
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                            {suggestions.map((suggestion, index) => (
                                <label key={suggestion.headline + index} className={`block rounded-xl border ${selectedSuggestionIndex === index ? 'border-brand-primary bg-brand-primary/10' : 'border-slate-700/70 bg-slate-800/50'} p-5 transition-colors cursor-pointer`}>
                                    <div className="flex items-start gap-4">
                                        <input type="radio" name="business-description" value={index} checked={selectedSuggestionIndex === index} onChange={() => setSelectedSuggestionIndex(index)} className="mt-1 h-4 w-4 text-brand-primary focus:ring-brand-primary" />
                                        <div className="space-y-2">
                                            <p className="text-brand-primary font-semibold text-sm uppercase tracking-wide">{suggestion.headline}</p>
                                            <p className="text-slate-100 leading-relaxed text-sm">{suggestion.description}</p>
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                        {error && <p className="text-sm text-red-300 mt-4 text-center">{error}</p>}
                        <button type="submit" disabled={selectedSuggestionIndex === null} className="w-full mt-6 bg-brand-primary text-white font-bold py-3 rounded-lg hover:bg-brand-primary/90 transition-all duration-300 disabled:bg-brand-primary/50 disabled:cursor-not-allowed">
                            Siguiente
                        </button>
                        <button type="button" onClick={() => setStep(1)} className="w-full mt-2 text-slate-400 hover:text-white text-sm">
                            Volver
                        </button>
                    </motion.div>
                );
            case 3:
                return (
                    <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                        <h2 className="text-2xl font-bold text-center mb-1">Último paso: crea tu cuenta</h2>
                        <p className="text-slate-400 text-center mb-6">Estos serán tus datos de acceso como administrador.</p>
                        <div className="flex flex-col gap-4">
                            <div className="relative">
                                <UserIcon className="w-5 h-5 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3" />
                                <input type="text" placeholder="Tu nombre" value={adminName} onChange={(e) => setAdminName(e.target.value)} required className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent" />
                            </div>
                            <div className="relative">
                                <EnvelopeIcon className="w-5 h-5 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3" />
                                <input type="email" placeholder="Email de contacto" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent" />
                            </div>
                            <div className="relative">
                                <LockClosedIcon className="w-5 h-5 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3" />
                                <input type="password" placeholder="Contraseña (mín. 6 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent" />
                            </div>
                        </div>
                        {error && <p className="text-sm text-red-300 mt-4 text-center">{error}</p>}
                        <button type="submit" disabled={isLoading || !adminName || !email || password.length < 6} className="w-full mt-6 bg-brand-primary text-white font-bold py-3 rounded-lg hover:bg-brand-primary/90 transition-all duration-300 disabled:bg-brand-primary/50 disabled:cursor-not-allowed flex items-center justify-center">
                            {isLoading ? <><svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"></svg>Creando tienda...</> : 'Crear mi Tienda'}
                        </button>
                        <button type="button" onClick={() => setStep(2)} className="w-full mt-2 text-slate-400 hover:text-white text-sm">
                            Volver
                        </button>
                    </motion.div>
                );
            default:
                return null;
        }
    };

    return (
        <>
            <title>Registro de Empresa | E-souvenirs</title>
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md text-center mb-8">
                    <Link to="/" className="text-3xl font-bold text-brand-primary">
                        E-souvenirs
                    </Link>
                    <h1 className="text-3xl font-bold mt-4">Crea tu Tienda</h1>
                    <p className="text-slate-400 mt-2">Únete a la comunidad de artesanos y empieza a vender hoy.</p>
                </div>
                <motion.div
                    className="w-full max-w-md"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <form 
                        onSubmit={step === 3 ? handleCreateAccount : handleSubmit} 
                        className="bg-slate-800/60 border border-slate-700/80 p-8 rounded-2xl shadow-2xl"
                    >
                        {renderStepContent()}
                        {step < 3 && (
                             <p className="text-center text-sm text-slate-400 mt-6">
                                ¿Ya tienes una cuenta? <Link to="/login" className="font-medium text-brand-primary hover:underline">Inicia sesión</Link>
                            </p>
                        )}
                    </form>
                </motion.div>
            </div>
        </>
    );
};


export default CompanyRegistrationPage;
