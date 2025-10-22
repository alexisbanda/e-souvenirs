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

            // 2. Crear la empresa en Firestore y obtener su UID
            const companySlug = slugify(companyName);
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
                adminUid: user.uid, // Guardar el UID del admin
            };

            const companyDocRef = await addDoc(collection(db, 'companies'), newCompany);
            const companyId = companyDocRef.id;

            // 3. Crear el documento del usuario en la colección 'users' con el UID de la empresa
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

            // 4. Crear una categoría inicial basada en la descripción IA
            // Usar solo la primera palabra del headline, o las dos primeras si hay más de una
            const headlineWords = (selectedSuggestion.headline || 'Categoría Principal').split(' ');
            const categoryName = headlineWords.slice(0, 2).join(' ');
            const initialCategory = {
                name: categoryName,
                description: selectedSuggestion.description,
                companyId,
                featured: true,
                icon: '🎉',
                image: 'https://placehold.co/400x300?text=Categoría+de+Ejemplo',
                // @ts-ignore
                createdAt: serverTimestamp(),
            };
            await createCategory(initialCategory);

            // 5. Crear un producto de prueba asignado a la nueva categoría
            const initialProduct = {
                name: 'Producto de ejemplo',
                description: selectedSuggestion.description,
                price: 100,
                category: categoryName,
                images: [
                    'https://placehold.co/400x300?text=Producto+de+Ejemplo'
                ],
                isFeatured: true,
                customizationConfig: {
                    text: {
                        label: 'Texto personalizado',
                    },
                    color: {
                        label: 'Color',
                        options: ['Rojo', 'Azul', 'Verde', 'Negro', 'Blanco'],
                    },
                    date: {
                        label: 'Fecha especial',
                    },
                },
                companyId,
                // @ts-ignore
                createdAt: serverTimestamp(),
            };
            await createProduct(initialProduct);

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
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
                {/* Título y mensaje fuera del formulario */}
                <div className="w-full max-w-5xl text-center mb-8">
                    <Link to="/" className="text-3xl font-bold text-brand-primary">
                        E-souvenirs
                    </Link>
                    <h1 className="text-3xl font-bold mt-4">Crea tu Tienda</h1>
                    <p className="text-slate-400 mt-2">Únete a la comunidad de artesanos y empieza a vender hoy.</p>
                </div>
                <motion.div 
                    className="w-full max-w-5xl"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <form 
                        onSubmit={handleSubmit} 
                        className="bg-slate-800/60 border border-slate-700/80 p-8 rounded-2xl shadow-2xl w-full max-w-4xl mx-auto"
                    >
                        <div className="md:grid md:grid-cols-2 gap-8 flex flex-col">
                            {/* Columna 1: Registro principal */}
                            <div className="order-2 md:order-1">
                                {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg text-center mb-4">{error}</div>}
                                <div className="flex flex-col gap-5">
                                    {/* En mobile, mostrar primero el nombre de la empresa, luego descripción y sugerencias IA */}
                                    <div className="block md:hidden">
                                        <div className="relative mb-4">
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
                                        <div className="space-y-3 mb-4">
                                            <label className="block text-sm font-medium text-slate-300">¿Qué vendes o qué quieres promocionar? <span className="text-red-400">*</span></label>
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
                                            <div className="space-y-4 mb-4">
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
                                                                    <p className="text-xs text-slate-300"><span className="font-semibold">Mensaje de bienvenida:</span> {suggestion.welcomeMessage}</p>
                                                                </div>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    {/* ...campos de registro restantes... */}
                                    <div className="relative hidden md:block">
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
                                        disabled={isLoading || !suggestions.length || selectedSuggestionIndex === null || !seedDescription.trim()}
                                        className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg hover:bg-brand-primary/90 transition-all duration-300 disabled:bg-brand-primary/50 disabled:cursor-not-allowed flex items-center justify-center mt-2"
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
                                    <p className="text-center text-sm text-slate-400 mt-2">
                                        ¿Ya tienes una cuenta? <Link to="/login" className="font-medium text-brand-primary hover:underline">Inicia sesión</Link>
                                    </p>
                                </div>
                            </div>
                            {/* Columna 2: Sugerencias IA (solo desktop) */}
                            <div className="hidden md:flex flex-col justify-start order-1 md:order-2">
                                <div className="space-y-3 mb-8">
                                    <label className="block text-sm font-medium text-slate-300">¿Qué vendes o qué quieres promocionar? <span className="text-red-400">*</span></label>
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
                                                            <p className="text-xs text-slate-300"><span className="font-semibold">Mensaje de bienvenida:</span> {suggestion.welcomeMessage}</p>
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>
                </motion.div>
            </div>
        </>
    );
};

export default CompanyRegistrationPage;
