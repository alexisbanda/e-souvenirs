import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BuildingOffice2Icon, UserIcon, EnvelopeIcon, LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { Company } from '../types/company';
import { AppUser } from '../types/user';

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
};

const CompanyRegistrationPage: React.FC = () => {
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

    const handleGenerateSuggestions = async () => {
        setSuggestionsError(null);

        if (!companyName.trim()) {
            setSuggestionsError('Completa el nombre de tu empresa antes de generar sugerencias.');
            return;
        }

        if (!seedDescription.trim()) {
            setSuggestionsError('Cuéntanos brevemente qué vendes para que podamos ayudarte.');
            return;
        }

        setIsGeneratingSuggestions(true);
        setSelectedSuggestionIndex(null);

        try {
            const response = await fetch('/.netlify/functions/generate-business-descriptions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    companyName,
                    seedDescription,
                }),
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
        setIsLoading(true);
        setError(null);

        if (!suggestions.length || selectedSuggestionIndex === null) {
            setIsLoading(false);
            setError('Selecciona una descripción recomendada por IA antes de continuar.');
            return;
        }

        const selectedSuggestion = suggestions[selectedSuggestionIndex];

        try {
            // 1. Crear el usuario en Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Actualizar el perfil del usuario con su nombre
            await updateProfile(user, { displayName: adminName });

            // 2. Crear la empresa en Firestore
            const companySlug = slugify(companyName);
            const companyRef = doc(db, 'companies', companySlug);
            const newCompany: Omit<Company, 'id'> = {
                name: companyName,
                slug: companySlug,
                description: selectedSuggestion.description,
                contact: {
                    email,
                    contactName: adminName,
                },
                settings: {
                    allowCustomizations: true,
                    enableAIAssistant: true,
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
                adminUid: user.uid, // Guardar el UID del admin
            };

            await setDoc(companyRef, newCompany);

            // 3. Crear el documento del usuario en la colección 'users'
            const userRef = doc(db, 'users', user.uid);
            const newUser: AppUser = {
                id: user.uid,
                email,
                name: adminName,
                role: 'companyadmin',
                companyId: companySlug,
                // @ts-ignore
                createdAt: serverTimestamp(),
            };
            await setDoc(userRef, newUser);
            
            // Redirigir a una página de éxito
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

    return (
        <>
            <title>Registro de Empresa | E-souvenirs</title>
            <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
                <motion.div 
                    className="w-full max-w-md"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="text-center mb-8">
                        <Link to="/" className="text-3xl font-bold text-brand-primary">
                            E-souvenirs
                        </Link>
                        <h1 className="text-3xl font-bold mt-4">Crea tu Tienda</h1>
                        <p className="text-slate-400 mt-2">Únete a la comunidad de artesanos y empieza a vender hoy.</p>
                    </div>

                    <form 
                        onSubmit={handleSubmit} 
                        className="bg-slate-800/60 border border-slate-700/80 p-8 rounded-2xl shadow-2xl space-y-6"
                    >
                        {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg text-center">{error}</div>}

                        <div className="relative">
                            <BuildingOffice2Icon className="w-5 h-5 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3" />
                            <input
                                type="text"
                                placeholder="Nombre de la empresa"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                required
                                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            />
                        </div>
                        <div className="relative">
                            <UserIcon className="w-5 h-5 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3" />
                            <input
                                type="text"
                                placeholder="Tu nombre"
                                value={adminName}
                                onChange={(e) => setAdminName(e.target.value)}
                                required
                                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-slate-300">¿Qué vendes o qué quieres promocionar?</label>
                            <div className="relative">
                                <textarea
                                    placeholder="Ej. Souvenirs personalizados para bodas y eventos corporativos"
                                    value={seedDescription}
                                    onChange={(e) => setSeedDescription(e.target.value)}
                                    required
                                    rows={3}
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 pl-4 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleGenerateSuggestions}
                                disabled={isGeneratingSuggestions}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-brand-primary/80"
                            >
                                <SparklesIcon className="w-5 h-5" />
                                {isGeneratingSuggestions ? 'Generando sugerencias...' : 'Generar sugerencias con IA'}
                            </button>
                            {suggestionsError && <p className="text-sm text-red-300">{suggestionsError}</p>}
                        </div>
                        {suggestions.length > 0 && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-300">Elige la descripción que mejor represente a tu negocio:</p>
                                {suggestions.map((suggestion, index) => {
                                    const isSelected = selectedSuggestionIndex === index;
                                    return (
                                        <label
                                            key={suggestion.headline + index}
                                            className={`block rounded-xl border ${isSelected ? 'border-brand-primary bg-brand-primary/10' : 'border-slate-700/70 bg-slate-800/50'} p-5 transition-colors cursor-pointer`}
                                        >
                                            <div className="flex items-start gap-4">
                                                <input
                                                    type="radio"
                                                    name="business-description"
                                                    value={index}
                                                    checked={isSelected}
                                                    onChange={() => setSelectedSuggestionIndex(index)}
                                                    className="mt-1 h-4 w-4 text-brand-primary focus:ring-brand-primary"
                                                />
                                                <div className="space-y-2">
                                                    <p className="text-brand-primary font-semibold text-sm uppercase tracking-wide">{suggestion.headline}</p>
                                                    <p className="text-slate-100 leading-relaxed text-sm">{suggestion.description}</p>
                                                    <p className="text-xs text-slate-300"><span className="font-semibold">Cliente ideal:</span> {suggestion.targetAudience}</p>
                                                    <p className="text-xs text-slate-300"><span className="font-semibold">Objetivo de venta:</span> {suggestion.salesObjective}</p>
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                        <div className="relative">
                            <EnvelopeIcon className="w-5 h-5 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3" />
                            <input
                                type="email"
                                placeholder="Email de contacto"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            />
                        </div>
                        <div className="relative">
                            <LockClosedIcon className="w-5 h-5 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3" />
                            <input
                                type="password"
                                placeholder="Contraseña"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            />
                        </div>

                        <button 
                            type="submit"
                            disabled={isLoading || !suggestions.length || selectedSuggestionIndex === null}
                            className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg hover:bg-brand-primary/90 transition-all duration-300 disabled:bg-brand-primary/50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isLoading ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                'Crear mi Tienda'
                            )}
                        </button>

                        <p className="text-center text-sm text-slate-400">
                            ¿Ya tienes una cuenta? <Link to="/login" className="font-medium text-brand-primary hover:underline">Inicia sesión</Link>
                        </p>
                    </form>
                </motion.div>
            </div>
        </>
    );
};

export default CompanyRegistrationPage;
