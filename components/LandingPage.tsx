import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { TypeAnimation } from 'react-type-animation';
import { Trans, useTranslation } from 'react-i18next';
import { FiPenTool, FiStore, FiBarChart2 } from 'react-icons/fi';
import { ArrowRightIcon, SparklesIcon, ShoppingBagIcon, PencilSquareIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { db } from '../services/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Company } from '../types/company';
import { BuildingStorefrontIcon, CheckIcon } from '@heroicons/react/24/solid';
import { PricingPlan } from '../types/pricing';
import { defaultHeroImages } from '../utils/constants';

const LandingPage: React.FC = () => {
    const { t, i18n } = useTranslation();

    const basicPlanFeatures = t('landing.pricing.basic_plan_features', { returnObjects: true });
    const proPlanFeatures = t('landing.pricing.pro_plan_features', { returnObjects: true });
    const enterprisePlanFeatures = t('landing.pricing.enterprise_plan_features', { returnObjects: true });

    const pricingPlans: PricingPlan[] = [
        {
            name: t('landing.pricing.basic_plan_name'),
            price: t('landing.pricing.basic_plan_price'),
            features: Array.isArray(basicPlanFeatures) ? basicPlanFeatures : [],
            isFeatured: false,
        },
        {
            name: t('landing.pricing.pro_plan_name'),
            price: t('landing.pricing.pro_plan_price'),
            features: Array.isArray(proPlanFeatures) ? proPlanFeatures : [],
            isFeatured: true,
        },
        {
            name: t('landing.pricing.enterprise_plan_name'),
            price: t('landing.pricing.enterprise_plan_price'),
            features: Array.isArray(enterprisePlanFeatures) ? enterprisePlanFeatures : [],
            isFeatured: false,
        },
    ];
    const [companies, setCompanies] = React.useState<Company[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex(prevIndex => 
                (prevIndex + 1) % defaultHeroImages.length
            );
        }, 5000); // Change image every 5 seconds

        return () => clearInterval(interval); // Cleanup on unmount
    }, []);

    React.useEffect(() => {
        const fetchCompanies = async () => {
            try {
                // We'll fetch approved or active companies to showcase
                const q = query(collection(db, "companies"), where("featured", "==", true), where("status", "in", ["APPROVED", "ACTIVE"]));
                const querySnapshot = await getDocs(q);
                const companiesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
                // Let's show a limited number for a clean look
                setCompanies(companiesData.slice(0, 5)); 
            } catch (error) {
                console.error("Error fetching companies for testimonials: ", error);
            }
        };

        fetchCompanies();
    }, []);

    const sectionVariants: Variants = {
        hidden: { opacity: 0, y: 50 },
        visible: { 
            opacity: 1, 
            y: 0, 
            transition: { duration: 0.8, ease: "easeOut" } 
        }
    };

    return (
        <>
            <title>E-souvenirs | Tu Tienda Online, Lista en Minutos</title>
            <main className="relative bg-slate-900 text-gray-300 font-sans">
                <div className="absolute top-4 right-4 z-20">
                    <select
                        onChange={(e) => i18n.changeLanguage(e.target.value)}
                        value={i18n.language}
                        className="bg-slate-800/60 border border-slate-700/80 text-white py-2 px-3 rounded-md text-sm font-medium transition-colors duration-300 hover:bg-slate-700"
                    >
                        <option value="es" className="bg-slate-800 text-white">ES</option>
                        <option value="en" className="bg-slate-800 text-white">EN</option>
                    </select>
                </div>
                {/* Hero Section */}
                <motion.section 
                    className="relative text-white text-center min-h-screen flex items-center justify-center overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="absolute inset-0">
                        <AnimatePresence>
                            <motion.img
                                key={currentImageIndex}
                                src={defaultHeroImages[currentImageIndex]}
                                alt={t('landing.hero.image_alt')}
                                className="absolute inset-0 w-full h-full object-cover"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1.5, ease: "easeInOut" }}
                            />
                        </AnimatePresence>
                        <div className="absolute inset-0 bg-slate-900/70 bg-gradient-to-t from-slate-900 via-transparent"></div>
                    </div>
                    <div className="container mx-auto px-6 relative z-10">
                        <motion.h1 
                            className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tighter"
                            initial={{ y: -30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.7, ease: "easeOut" }}
                        >
                                                                                        <Trans
                                                                                            i18nKey="landing.hero.title"
                                                                                            components={[
                                                                                                <TypeAnimation
                                                                                                    key={i18n.language}
                                                                                                                                            sequence={[
                                                                                                                                                t('words.artisan'),
                                                                                                                                                1500,
                                                                                                                                                t('words.entrepreneur'),
                                                                                                                                                1500,
                                                                                                                                                t('words.merchant'),
                                                                                                                                                1500,
                                                                                                                                                t('words.seller'),
                                                                                                                                                1500,
                                                                                                                                            ]}                                                                                                    wrapper="span"
                                                                                                    speed={50}
                                                                                                    className="text-highlight"
                                                                                                    repeat={Infinity}
                                                                                                />,
                                                                                                <span className="text-brand-primary" />,
                                                                                                <span className="text-brand-primary" />
                                                                                            ]}
                                                                                        />                        </motion.h1>
                        <motion.p 
                            className="text-lg md:text-xl mb-12 max-w-3xl mx-auto text-white/80"
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4, duration: 0.7, ease: "easeOut" }}
                        >
                            <Trans i18nKey="landing.hero.subtitle"
                                components={[
                                    <span className="text-brand-primary" />,
                                    <span className="text-brand-primary" />,
                                    <span className="text-brand-primary" />,
                                    <span className="text-brand-primary" />
                                ]}
                            />
                        </motion.p>
                        <motion.div
                            className="flex flex-col sm:flex-row items-center justify-center gap-6"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.6, duration: 0.5, ease: "easeOut" }}
                        >
                            <Link to="/register-company" className="group bg-brand-primary text-white font-bold py-4 px-10 rounded-full hover:bg-brand-primary/90 transition-all duration-300 text-lg shadow-lg hover:shadow-brand-primary/40 transform hover:-translate-y-1 inline-flex items-center gap-3">
                                {t('landing.hero.cta_launch')} <ArrowRightIcon className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>
                            <a
                                href="#pricing"
                                onClick={(e) => {
                                    e.preventDefault();
                                    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="group bg-transparent border-2 border-white text-white font-bold py-4 px-10 rounded-full hover:bg-white hover:text-slate-900 transition-all duration-300 text-lg transform hover:-translate-y-1 inline-flex items-center gap-3"
                            >
                                {t('landing.hero.cta_plans')}
                            </a>
                        </motion.div>
                    </div>
                </motion.section>

                {/* Features Section */}
                <motion.section 
                    className="py-28 bg-slate-900/50"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                >
                    <div className="container mx-auto px-6">
                        <h2 className="text-4xl font-bold text-center mb-20 text-white tracking-tight">{t('landing.features.title')}</h2>
                        <div className="grid md:grid-cols-3 gap-12 text-center">
                            <motion.div className="p-8 bg-slate-800/60 rounded-2xl transition-all duration-300 border border-slate-700/80" whileHover={{ y: -8, background: 'rgb(30 41 59 / 0.8)', borderColor: '#475569' }}>
                                <SparklesIcon className="w-12 h-12 text-brand-primary mx-auto mb-5" />
                                <h3 className="text-2xl font-bold mb-3 text-white">{t('landing.features.instant_creation_title')}</h3>
                                <p className="text-gray-400">{t('landing.features.instant_creation_description')}</p>
                            </motion.div>
                            <motion.div className="p-8 bg-slate-800/60 rounded-2xl transition-all duration-300 border border-slate-700/80" whileHover={{ y: -8, background: 'rgb(30 41 59 / 0.8)', borderColor: '#475569' }}>
                                <ShoppingBagIcon className="w-12 h-12 text-brand-primary mx-auto mb-5" />
                                <h3 className="text-2xl font-bold mb-3 text-white">{t('landing.features.no_commission_title')}</h3>
                                <p className="text-gray-400">{t('landing.features.no_commission_description')}</p>
                            </motion.div>
                            <motion.div className="p-8 bg-slate-800/60 rounded-2xl transition-all duration-300 border border-slate-700/80" whileHover={{ y: -8, background: 'rgb(30 41 59 / 0.8)', borderColor: '#475569' }}>
                                <FiBarChart2 className="text-4xl text-brand-primary mx-auto mb-5" />
                                <h3 className="text-2xl font-bold mb-3 text-white">{t('landing.features.all_in_one_title')}</h3>
                                <p className="text-gray-400">{t('landing.features.all_in_one_description')}</p>
                            </motion.div>
                        </div>
                    </div>
                </motion.section>

                {/* How it works */}
                <motion.section 
                    className="py-28"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                >
                    <div className="container mx-auto px-6">
                        <div className="grid md:grid-cols-5 gap-16 items-center">
                            <div className="relative md:col-span-2">
                                <img src="https://images.unsplash.com/photo-1628348723340-2fb9ec19753b?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=735" alt={t('landing.how_it_works.image_alt')} className="rounded-2xl shadow-2xl w-full h-auto object-cover"/>                            </div>
                            <div className="md:col-span-3">
                                <h2 className="text-4xl font-bold mb-12 text-white tracking-tight">{t('landing.how_it_works.title')}</h2>
                                <ul className="space-y-10">
                                    <li className="flex items-start">
                                        <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-xl bg-slate-800 text-brand-primary border-2 border-slate-700">
                                            <PencilSquareIcon className="w-8 h-8" />
                                        </div>
                                        <div className="ml-6">
                                            <h3 className="text-xl font-bold text-white">{t('landing.how_it_works.step1_title')}</h3>
                                            <p className="text-gray-400 mt-2">{t('landing.how_it_works.step1_description')}</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start">
                                        <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-xl bg-slate-800 text-brand-primary border-2 border-slate-700">
                                            <SparklesIcon className="w-8 h-8" />
                                        </div>
                                        <div className="ml-6">
                                            <h3 className="text-xl font-bold text-white">{t('landing.how_it_works.step2_title')}</h3>
                                            <p className="text-gray-400 mt-2">{t('landing.how_it_works.step2_description')}</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start">
                                        <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-xl bg-slate-800 text-brand-primary border-2 border-slate-700">
                                            <GlobeAltIcon className="w-8 h-8" />
                                        </div>
                                        <div className="ml-6">
                                            <h3 className="text-xl font-bold text-white">{t('landing.how_it_works.step3_title')}</h3>
                                            <p className="text-gray-400 mt-2">{t('landing.how_it_works.step3_description')}</p>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* Pricing Section */}
                <motion.section
                    id="pricing"
                    className="py-28"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                >
                    <div className="container mx-auto px-6">
                        <h2 className="text-4xl font-bold text-center mb-4 text-white tracking-tight">{t('landing.pricing.title')}</h2>
                        <p className="text-lg text-gray-400 text-center mb-20 max-w-3xl mx-auto">
                            {t('landing.pricing.subtitle')}
                        </p>
                        <div className="flex flex-col md:flex-row justify-center items-center gap-8 max-w-4xl mx-auto">
                            {pricingPlans.map((plan) => (
                                <div key={plan.name} className={`relative w-full p-8 rounded-2xl border ${plan.isFeatured ? 'border-brand-primary/80 bg-slate-800' : 'border-slate-700 bg-slate-800/60'}`}>
                                    {plan.isFeatured && (
                                        <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2">
                                            <span className="bg-brand-primary text-white text-xs font-bold px-4 py-1 rounded-full uppercase">{t('landing.pricing.most_popular')}</span>
                                        </div>
                                    )}
                                    <h3 className="text-2xl font-bold text-white text-center mb-2">{plan.name}</h3>
                                    <div className="text-center mb-8">
                                        {plan.price === "Custom" || plan.price === "A Medida" ? (
                                            <span className="text-4xl font-extrabold text-white">{t('landing.pricing.enterprise_plan_price')}</span>
                                        ) : (
                                            <>
                                                <span className="text-4xl font-extrabold text-white">${plan.price}</span>
                                                <span className="text-lg text-gray-400">{t('landing.pricing.month')}</span>
                                            </>
                                        )}
                                    </div>
                                    <ul className="space-y-4 mb-10">
                                        {plan.features.map((feature, index) => (
                                            <li key={index} className="flex items-center">
                                                <CheckIcon className="w-5 h-5 text-green-500 mr-3" />
                                                <span className="text-gray-300">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    {plan.price !== "Custom" && plan.price !== "A Medida" ? (
                                        <Link
                                            to="/register-company"
                                            className={`w-full text-center font-bold py-3 px-6 rounded-lg transition-all duration-300 ${plan.isFeatured ? 'bg-brand-primary text-white hover:bg-brand-primary/90' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                                        >
                                            {t('landing.pricing.start_now')}
                                        </Link>
                                    ) : (
                                        <a
                                            href="#contact-form"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' });
                                            }}
                                            className={`w-full text-center font-bold py-3 px-6 rounded-lg transition-all duration-300 ${plan.isFeatured ? 'bg-brand-primary text-white hover:bg-brand-primary/90' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                                        >
                                            {t('landing.pricing.contact_sales')}
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.section>

                {/* Testimonials Section */}
                {companies.length > 0 && (
                    <motion.section
                        className="py-28"
                        variants={sectionVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.2 }}
                    >
                        <div className="container mx-auto px-6 text-center">
                            <h2 className="text-4xl font-bold mb-4 text-white tracking-tight">{t('landing.testimonials.title')}</h2>
                            <p className="text-lg text-gray-400 mb-20 max-w-3xl mx-auto">
                                {t('landing.testimonials.subtitle')}
                            </p>
                            <div className="flex justify-center items-center flex-wrap gap-x-12 gap-y-8">
                                {companies.map((company) => (
                                    <Link to={`/${company.slug}`} key={company.id} className="group text-center" title={company.name}>
                                        <motion.div
                                            whileHover={{ y: -5 }}
                                            className="flex flex-col items-center gap-3"
                                        >
                                            <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:border-brand-primary group-hover:shadow-lg group-hover:shadow-brand-primary/20">
                                                {company.logo ? (
                                                    <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <BuildingStorefrontIcon className="w-10 h-10 text-slate-500 transition-colors group-hover:text-brand-primary" />
                                                )}
                                            </div>
                                            <span className="text-sm font-medium text-gray-400 transition-colors group-hover:text-white w-28 truncate">{company.name}</span>
                                        </motion.div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </motion.section>
                )}

                {/* Contact Form Section */}
                <motion.section
                    id="contact-form"
                    className="py-28 bg-slate-900/50"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                >
                    <div className="container mx-auto px-6">
                        <h2 className="text-4xl font-bold text-center mb-4 text-white tracking-tight">{t('landing.contact.title')}</h2>
                        <p className="text-lg text-gray-400 text-center mb-12 max-w-3xl mx-auto">
                            {t('landing.contact.subtitle')}
                        </p>
                        <div className="max-w-2xl mx-auto">
                            <form name="contact-enterprise" method="POST" data-netlify="true" netlify-honeypot="bot-field">
                                <input type="hidden" name="form-name" value="contact-enterprise" />
                                <div className="hidden">
                                    <label>Don’t fill this out if you’re human: <input name="bot-field" /></label>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">{t('landing.contact.name_label')}</label>
                                        <input type="text" name="name" id="name" required className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-brand-primary focus:border-brand-primary" />
                                    </div>
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">{t('landing.contact.email_label')}</label>
                                        <input type="email" name="email" id="email" required className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-brand-primary focus:border-brand-primary" />
                                    </div>
                                </div>
                                <div className="mb-6">
                                    <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-2">{t('landing.contact.company_label')}</label>
                                    <input type="text" name="company" id="company" className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-brand-primary focus:border-brand-primary" />
                                </div>
                                <div className="mb-6">
                                    <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">{t('landing.contact.message_label')}</label>
                                    <textarea name="message" id="message" rows={5} required className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-brand-primary focus:border-brand-primary"></textarea>
                                </div>
                                <div className="text-center">
                                    <button type="submit" className="bg-brand-primary text-white font-bold py-3 px-10 rounded-full hover:bg-brand-primary/90 transition-all duration-300 text-lg shadow-lg hover:shadow-brand-primary/40">
                                        {t('landing.contact.send_button')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </motion.section>

                {/* CTA Section */}
                <motion.section 
                    className="bg-gradient-to-t from-slate-900 via-slate-800 to-brand-primary/20 text-white text-center py-28"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                >
                    <div className="container mx-auto px-6">
                        <h2 className="text-5xl font-extrabold mb-6 tracking-tighter">{t('landing.cta.title')}</h2>
                        <p className="text-xl mb-12 text-white/70">{t('landing.cta.subtitle')}</p>
                        <Link to="/register-company" className="group bg-white text-slate-900 font-bold py-4 px-10 rounded-full hover:bg-gray-200 transition-all duration-300 text-lg shadow-lg hover:shadow-white/20 transform hover:-translate-y-1 inline-flex items-center gap-3">
                            {t('landing.cta.button')} <ArrowRightIcon className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                        </Link>
                    </div>
                </motion.section>
            </main>
        </>
    );
};

export default LandingPage;
    