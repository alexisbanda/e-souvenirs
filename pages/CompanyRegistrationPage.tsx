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

import { useTranslation } from 'react-i18next';

const CompanyRegistrationPage: React.FC = () => {
    const { t } = useTranslation();
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
            setError(t('company_registration.error_missing_fields'));
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
                throw new Error(errorPayload.error || t('company_registration.error_generating_suggestions'));
            }

            const data = await response.json() as { options?: BusinessSuggestion[] };
            const options = data.options || [];

            if (!options.length) {
                throw new Error(t('company_registration.error_no_suggestions'));
            }

            setSuggestions(options);
            setStep(2); // Avanzar al siguiente paso
        } catch (err: any) {
            console.error('Failed to generate suggestions:', err);
            setSuggestions([]);
            setSuggestionsError(err.message || t('company_registration.error_generating_suggestions'));
        } finally {
            setIsGeneratingSuggestions(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedSuggestionIndex === null) {
            setError(t('company_registration.error_selecting_suggestion'));
            return;
        }
        setStep(3); // Avanzar al paso de creación de cuenta
    };

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (selectedSuggestionIndex === null) {
            setError(t('company_registration.error_no_suggestion_selected'));
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
                name: t('initial_product.name'),
                description: selectedSuggestion.description,
                price: 100,
                category: categoryName,
                images: [getRandomImage()],
                isFeatured: true,
                customizationConfig: {
                    text: { label: t('initial_product.customization_text_label') },
                    color: { label: t('initial_product.customization_color_label'), options: t('initial_product.customization_color_options', { returnObjects: true }) },
                    date: { label: t('initial_product.customization_date_label') },
                },
                companyId,
                // @ts-ignore
                createdAt: serverTimestamp(),
            };
            await createProduct(initialProduct);

            navigate('/registration-success');
        } catch (err: any) {
            let errorMessage = t('company_registration.error_creating_company');
            if (err.code === 'auth/email-already-in-use') {
                errorMessage = t('company_registration.error_email_in_use');
            } else if (err.code === 'auth/weak-password') {
                errorMessage = t('company_registration.error_weak_password');
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
                        <h2 className="text-2xl font-bold text-center mb-1">{t('company_registration.step1_title')}</h2>
                        <p className="text-slate-400 text-center mb-6">{t('company_registration.step1_subtitle')}</p>
                        <div className="space-y-4">
                            <div className="relative">
                                <BuildingOffice2Icon className="w-5 h-5 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3" />
                                <input type="text" placeholder={t('company_registration.company_name_placeholder')} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent" />
                            </div>
                            <div className="relative">
                                <textarea placeholder={t('company_registration.seed_description_placeholder')} value={seedDescription} onChange={(e) => setSeedDescription(e.target.value)} required rows={4} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none" />
                            </div>
                        </div>
                        {error && <p className="text-sm text-red-300 mt-4 text-center">{error}</p>}
                        <button type="button" onClick={handleGenerateSuggestions} disabled={isGeneratingSuggestions || !companyName || !seedDescription} className="w-full mt-6 bg-brand-primary text-white font-bold py-3 rounded-lg hover:bg-brand-primary/90 transition-all duration-300 disabled:bg-brand-primary/50 disabled:cursor-not-allowed flex items-center justify-center">
                            {isGeneratingSuggestions ? <><svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"></svg>{t('company_registration.generating_button')}</> : <><SparklesIcon className="w-5 h-5 mr-2" />{t('company_registration.generate_suggestions_button')}</>}
                        </button>
                    </motion.div>
                );
            case 2:
                return (
                    <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                        <h2 className="text-2xl font-bold text-center mb-1">{t('company_registration.step2_title')}</h2>
                        <p className="text-slate-400 text-center mb-6">{t('company_registration.step2_subtitle')}</p>
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
                            {t('company_registration.next_button')}
                        </button>
                        <button type="button" onClick={() => setStep(1)} className="w-full mt-2 text-slate-400 hover:text-white text-sm">
                            {t('company_registration.back_button')}
                        </button>
                    </motion.div>
                );
            case 3:
                return (
                    <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                        <h2 className="text-2xl font-bold text-center mb-1">{t('company_registration.step3_title')}</h2>
                        <p className="text-slate-400 text-center mb-6">{t('company_registration.step3_subtitle')}</p>
                        <div className="flex flex-col gap-4">
                            <div className="relative">
                                <UserIcon className="w-5 h-5 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3" />
                                <input type="text" placeholder={t('company_registration.admin_name_placeholder')} value={adminName} onChange={(e) => setAdminName(e.target.value)} required className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent" />
                            </div>
                            <div className="relative">
                                <EnvelopeIcon className="w-5 h-5 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3" />
                                <input type="email" placeholder={t('company_registration.email_placeholder')} value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent" />
                            </div>
                            <div className="relative">
                                <LockClosedIcon className="w-5 h-5 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3" />
                                <input type="password" placeholder={t('company_registration.password_placeholder')} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent" />
                            </div>
                        </div>
                        {error && <p className="text-sm text-red-300 mt-4 text-center">{error}</p>}
                        <button type="submit" disabled={isLoading || !adminName || !email || password.length < 6} className="w-full mt-6 bg-brand-primary text-white font-bold py-3 rounded-lg hover:bg-brand-primary/90 transition-all duration-300 disabled:bg-brand-primary/50 disabled:cursor-not-allowed flex items-center justify-center">
                            {isLoading ? <><svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"></svg>{t('company_registration.creating_store_button')}</> : t('company_registration.create_store_button')}
                        </button>
                        <button type="button" onClick={() => setStep(2)} className="w-full mt-2 text-slate-400 hover:text-white text-sm">
                            {t('company_registration.back_button')}
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
                    <h1 className="text-3xl font-bold mt-4">{t('company_registration.title')}</h1>
                    <p className="text-slate-400 mt-2">{t('company_registration.subtitle')}</p>
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
                                {t('company_registration.already_have_account')} <Link to="/login" className="font-medium text-brand-primary hover:underline">{t('company_registration.login')}</Link>
                            </p>
                        )}
                    </form>
                </motion.div>
            </div>
        </>
    );
};


export default CompanyRegistrationPage;
