import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFeaturedProducts } from '../services/productService';
import { Product, Category } from '../types';
import { getCategories } from '../services/categoryService';
import { useCompany } from '../context/CompanyContext';
import ProductCard from '../components/ProductCard';
import Spinner from '../components/Spinner';
import QuoteModal from '../components/QuoteModal';
import IdeaWizard, { CategoryOption } from '../components/IdeaWizard';
import { motion, Variants } from 'framer-motion';
import ConceptCardSkeleton from '../components/ConceptCardSkeleton';
import LandingPage from '../components/LandingPage';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { type ISourceOptions } from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";


// Extend the Window interface to include Google Analytics
declare global {
    interface Window {
        ga?: (command: string, ...fields: any[]) => void;
    }
}

import { defaultHeroImages } from '../utils/constants';
import { SouvenirConcept } from '../types';

const HomePage: React.FC = () => {
    const { company } = useCompany();

    if (!company) {
        return <LandingPage />;
    }
    
    // --- State Management ---
    const [init, setInit] = useState(false);
    const [eventTypes, setEventTypes] = useState<CategoryOption[]>([]);
    const [concepts, setConcepts] = useState<SouvenirConcept[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isWaitingForResults, setIsWaitingForResults] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false); // This state is no longer the primary driver for showing results, but can be kept for other logic if needed.
    const [showRecaptchaNotification, setShowRecaptchaNotification] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [selectedConceptForQuote, setSelectedConceptForQuote] = useState<any | null>(null);
    const [variationLoadingConceptId, setVariationLoadingConceptId] = useState<string | null>(null);

    const handleConceptsGenerated = (newConcepts: any[]) => {
        setConcepts(newConcepts);
        setIsLoading(false);
        setIsWaitingForResults(false);
    };

    // --- Particles Init ---
    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadSlim(engine);
        }).then(() => {
            setInit(true);
        });
    }, []);

    const particleOptions: ISourceOptions = useMemo(
        () => ({
            background: {
                color: {
                    value: "transparent",
                },
            },
            fpsLimit: 60,
            interactivity: {
                events: {
                    onHover: {
                        enable: true,
                        mode: "repulse",
                    },
                },
                modes: {
                    repulse: {
                        distance: 100,
                        duration: 0.4,
                    },
                },
            },
            particles: {
                color: {
                    value: "#ffffff",
                },
                links: {
                    color: "#ffffff",
                    distance: 150,
                    enable: true,
                    opacity: 0.2,
                    width: 1,
                },
                move: {
                    direction: "none",
                    enable: true,
                    outModes: {
                        default: "bounce",
                    },
                    random: false,
                    speed: 1,
                    straight: false,
                },
                number: {
                    density: {
                        enable: true,
                    },
                    value: 80,
                },
                opacity: {
                    value: 0.2,
                },
                shape: {
                    type: "circle",
                },
                size: {
                    value: { min: 1, max: 3 },
                },
            },
            detectRetina: true,
        }),
        [],
    );

    // --- Animation Variants ---
    const sectionVariants: Variants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
    };

    const heroTitleVariants = {
        hidden: { opacity: 0, y: -20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.2 } }
    };

    const heroSubtitleVariants = {
        hidden: { opacity: 0, y: -20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.4 } }
    };

    const wizardVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.5, delay: 0.6 } }
    };

    const gridContainerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const gridItemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 },
    };

    const randomHeroImage = useMemo(() => {
        const randomIndex = Math.floor(Math.random() * defaultHeroImages.length);
        return defaultHeroImages[randomIndex];
    }, []);

    const getRandomImage = () => {
        const randomIndex = Math.floor(Math.random() * defaultHeroImages.length);
        return defaultHeroImages[randomIndex];
    };

    // --- Data Fetching ---
    useEffect(() => {
        const fetchProducts = async () => {
            setLoadingProducts(true);
            try {
                if (company?.id) {
                    const fetchedProducts = await getFeaturedProducts(company.id);
                    setProducts(fetchedProducts);
                }
            } catch (error) {
                console.error("Error fetching featured products:", error);
            } finally {
                setLoadingProducts(false);
            }
        };

        const fetchCategories = async () => {
            setLoadingCategories(true);
            try {
                if (company?.id) {
                    const fetchedCategories = await getCategories(company.id);
                    setCategories(fetchedCategories);
                    const eventOptions = fetchedCategories.map((c: Category) => ({ name: c.name, icon: c.icon || '🎁' }));
                    setEventTypes(eventOptions);
                }
            } catch (error) {
                console.error("Error fetching categories:", error);
            } finally {
                setLoadingCategories(false);
            }
        };

        if (company) {
            fetchProducts();
            fetchCategories();
        }
    }, [company]);

    const handleSubmit = async (prompt: string, baseConcept?: SouvenirConcept) => {
        setIsLoading(true);
        setError(null);
        setShowRecaptchaNotification(false);

        try {
            const response = await fetch('/.netlify/functions/generateConcepts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    userInput: prompt, 
                    baseConcept,
                    companySettings: company ? {
                        name: company.name,
                        aiPrompt: company.settings?.aiPrompt,
                    } : undefined,
                }),
            });

            if (!response.ok) {
                throw new Error('Error en la generación de conceptos');
            }

            const data = await response.json();
            // The concepts are now set via onConceptsUpdate from IdeaWizard's listener
            // setConcepts(data.concepts); 
            if (data.jobId) {
                // The listener in IdeaWizard will handle the updates.
                // We just need to make sure the initial state is set.
                setHasSearched(true); // We can use this to make sure the section appears
            }

            if (data.showRecaptcha) {
                setShowRecaptchaNotification(true);
            }
            
            // Scroll to results
            setTimeout(() => {
                const resultsSection = document.getElementById('ai-results');
                if (resultsSection) {
                    resultsSection.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);

        } catch (error: any) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVariationSubmit = async (originalConcept: any) => {
        console.log("Generating variations for:", originalConcept.name);
        setVariationLoadingConceptId(originalConcept.id); // O usa un identificador único si lo tienes
        setError(null);
    
        try {
            const response = await fetch('/.netlify/functions/start-concept-generation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: originalConcept.description, // O un prompt modificado para variaciones
                    isVariation: true,
                    originalConceptId: originalConcept.id,
                }),
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to start variation generation.');
            }
    
            const { jobId } = await response.json();
            handleSearchStart(jobId);
    
        } catch (err: any) {
            console.error("Variation generation error:", err);
            setError(err.message);
        } finally {
            setVariationLoadingConceptId(null);
        }
    };

    const handleCloseModal = () => {
        setSelectedConceptForQuote(null);
    };

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Home",
        description: "Página principal de E-souvenirs, donde puedes encontrar souvenirs únicos generados por IA.",
        url: window.location.href,
        potentialAction: {
            "@type": "SearchAction",
            target: `${window.location.origin}/search?query={query}`,
            "query-input": "required name=search_term_string"
        }
    };

    useEffect(() => {
        if (window.ga) {
            window.ga('set', 'page', window.location.pathname);
            window.ga('send', 'pageview');
        }
    }, []);

    const featuredCategories = categories.filter((cat: Category) => cat.featured);

    return (
        <>
            <title>E-souvenirs | Asistente de IA para Souvenirs</title>
            <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
            <style>
                {`
                    .swiper-pagination-bullet-active {
                        background-color: var(--brand-primary) !important;
                    }
                    .swiper-button-next, .swiper-button-prev {
                        color: var(--brand-primary) !important;
                    }
                `}
            </style>
            <main>
                {/* --- Image Modal --- */}
                {selectedImageUrl && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setSelectedImageUrl(null)}>
                        <div className="relative">
                            <img src={selectedImageUrl} alt="Imagen en alta resolución" className="max-w-screen-xl max-h-screen-xl rounded-lg shadow-2xl"/>
                            <button onClick={() => setSelectedImageUrl(null)} className="absolute -top-4 -right-4 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full text-white text-2xl font-bold flex items-center justify-center hover:bg-white/30 transition-colors">&times;</button>
                        </div>
                    </div>
                )}

                {/* --- Quote Modal --- */}
                {selectedConceptForQuote && (
                    <QuoteModal 
                        concept={selectedConceptForQuote} 
                        onClose={() => setSelectedConceptForQuote(null)} 
                        company={company}
                    />
                )}

                {/* --- Hero Section --- */}
                <section className="relative py-16 sm:py-20 md:py-28 flex flex-col items-center justify-center text-white bg-gray-900 overflow-hidden min-h-[90vh]">
                    <div className="absolute inset-0 overflow-hidden">
                        <motion.div 
                            className="absolute inset-0 bg-cover bg-center" 
                            style={{ backgroundImage: `url(${company?.settings?.heroImage?.trim() ? company.settings.heroImage : randomHeroImage})` }}
                            initial={{ scale: 1.1 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 15, ease: "linear", repeat: Infinity, repeatType: "mirror" }}
                        ></motion.div>
                        {init && <Particles options={particleOptions} />}
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-black/60 to-transparent"></div>
                    </div>
                    <div className="relative z-10 container mx-auto px-4">
                        {/* Main Headline */}
                        <div className="text-center mb-8 md:mb-12 bg-black/50 backdrop-blur-sm p-8 rounded-xl">
                            <motion.h1 
                                className="text-4xl tracking-tight font-extrabold sm:text-5xl md:text-6xl"
                                variants={heroTitleVariants}
                                initial="hidden"
                                animate="visible"
                            >
                                <span className="block font-serif">¿No sabes qué regalar?</span>
                                <span className="block font-serif text-brand-primary">Díselo a nuestra IA.</span>
                            </motion.h1>
                            <motion.p 
                                className="mt-4 max-w-3xl mx-auto text-xl text-white/90"
                                variants={heroSubtitleVariants}
                                initial="hidden"
                                animate="visible"
                            >
                                {company.description || 'Genera ideas únicas de souvenirs personalizados para cualquier ocasión especial con nuestro asistente creativo impulsado por IA.'}
                            </motion.p>
                        </div>

                        {/* Two-column layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
                            {/* Left Column: Featured Categories */}
                            <motion.div
                                initial={{ opacity: 0, x: -50 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8, delay: 0.4 }}
                            >
                                <h2 className="text-3xl font-serif font-bold text-white mb-6 text-center lg:text-left">Colecciones Destacadas</h2>
                                {loadingCategories ? (
                                    <div className="flex justify-center lg:justify-start"><Spinner /></div>
                                ) : featuredCategories.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-6">
                                        {featuredCategories.slice(0, 2).map((category) => (
                                            <Link
                                                key={category.id}
                                                to={company ? `/${company.slug}/catalogo?category=${encodeURIComponent(category.name)}` : `/catalogo?category=${encodeURIComponent(category.name)}`}
                                                className="group relative block overflow-hidden rounded-xl shadow-lg transform hover:-translate-y-2 transition-all duration-300 hover:shadow-brand-primary/20"
                                            >
                                                <img
                                                    src={category.image || getRandomImage()}
                                                    alt={`Colección de ${category.name}`}
                                                    className="w-full h-48 object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-50 transition-all duration-300 flex flex-col items-center justify-center p-4 text-center">
                                                    <h3 className="text-2xl font-serif font-bold text-white">{category.name}</h3>
                                                    <div className="mt-2 border-t-2 border-brand-primary w-12 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center"></div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-white/70">No hay colecciones destacadas por el momento.</p>
                                )}
                            </motion.div>

                            {/* Right Column: AI Wizard */}
                            <motion.div
                                variants={wizardVariants}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                transition={{ delay: 0.2 }}
                            >
                                <h2 className="text-3xl font-serif font-bold text-white mb-6 text-center lg:text-left">Asistente Creativo</h2>
                                <IdeaWizard 
                                    onConceptsUpdate={setConcepts} 
                                    onSearchStart={() => setIsWaitingForResults(true)}
                                    eventTypes={eventTypes} 
                                    isLoading={isLoading} 
                                    setIsLoading={setIsLoading} 
                                    companySettings={company?.settings}
                                />
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* --- AI Results Section --- */}
                {isWaitingForResults && (
                    <motion.section 
                        id="ai-results" 
                        className="py-16 sm:py-20 bg-gray-900 text-white relative overflow-hidden"
                        variants={sectionVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                    >
                         <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(to_bottom,white_10%,transparent_90%)]"></div>
                         <div className="container mx-auto px-4 relative z-10">
                            {showRecaptchaNotification && (
                                <div className="container mx-auto px-4 mb-8">
                                    <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4" role="alert">
                                        <p className="font-bold">¡Atención!</p>
                                        <p>La primera vez que generes imágenes, es posible que se te pida completar un reCAPTCHA para verificar que no eres un robot. Por favor, completa la verificación para continuar.</p>
                                    </div>
                                </div>
                            )}
                            
                            {error && <p className="text-center text-red-500">{error}</p>}
                            
                            {(isLoading || concepts.length > 0) && (
                                <div className="text-center mb-12">
                                    <h2 className="text-3xl font-serif font-bold text-white">Conceptos Creados para Ti</h2>
                                    <p className="text-lg mt-2 text-white/70">Aquí tienes 3 ideas únicas generadas por nuestra IA, basadas en tu petición.</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {isWaitingForResults && concepts.length === 0 ? (
                                    Array.from({ length: 3 }).map((_, i) => <ConceptCardSkeleton key={i} />)
                                ) : (
                                    concepts.map((concept, index) => (
                                        <motion.div 
                                            key={index} 
                                            className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-lg border border-white/10 overflow-hidden flex flex-col group"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.5, delay: index * 0.1 }}
                                        >
                                            <div className="w-full h-56 bg-black/20 flex items-center justify-center cursor-pointer overflow-hidden relative" onClick={() => concept.imageUrl && setSelectedImageUrl(concept.imageUrl)}>
                                                {concept.isGeneratingImage ? (
                                                    <Spinner />
                                                ) : concept.imageUrl ? (
                                                    <img src={concept.imageUrl} alt={concept.name} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300"/>
                                                ) : (
                                                    <div className="text-gray-400">No se pudo generar la imagen</div>
                                                )}
                                                 <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 1v4m0 0h-4m4 0l-5-5" /></svg>
                                                </div>
                                            </div>
                                            <div className="p-6 flex flex-col flex-grow">
                                                <h3 className="text-2xl font-serif font-bold text-brand-primary">{concept.name}</h3>
                                                <p className="mt-2 text-white/80 flex-grow">{concept.description}</p>
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {concept.materials.map(material => (
                                                        <span key={material} className="px-3 py-1 text-sm font-medium rounded-full bg-brand-secondary/20 text-brand-secondary">{material}</span>
                                                    ))}
                                                </div>
                                                <div className="mt-6 grid grid-cols-1 gap-3">
                                                    <button onClick={() => setSelectedConceptForQuote(concept)} className="w-full text-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary/90 transition-colors">
                                                        Me Interesa / Solicitar Cotización
                                                    </button>
                                                    <button 
                                                        onClick={() => handleVariationSubmit(concept)} 
                                                        disabled={variationLoadingConceptId !== null} 
                                                        className="w-full text-center px-6 py-3 border border-white/20 text-base font-medium rounded-md text-white bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
                                                    >
                                                        {variationLoadingConceptId === concept.id ? 'Generando...' : 'Generar Variaciones'}
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>
                    </motion.section>
                )}

                {/* All Collections */}
                <motion.section 
                    className="bg-brand-secondary/30 py-16 sm:py-20"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                >
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-serif font-bold text-center mb-12 text-brand-text">Explora Todas Nuestras Colecciones</h2>
                        {loadingCategories ? (
                            <div className="flex justify-center"><Spinner /></div>
                        ) : categories.length === 0 ? (
                            <p className="text-center text-gray-500">No hay colecciones configuradas para esta compañía.</p>
                        ) : (
                            <>
                                {/* Desktop Grid */}
                                <motion.div 
                                    className="hidden lg:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
                                    variants={gridContainerVariants}
                                    initial="hidden"
                                    whileInView="visible"
 x                                   viewport={{ once: true }}
                                >
                                    {categories.map((category) => (
                                        <motion.div
                                            key={category.id}
                                            variants={gridItemVariants}
                                        >
                                            <Link
                                                to={company ? `/${company.slug}/catalogo?category=${encodeURIComponent(category.name)}` : `/catalogo?category=${encodeURIComponent(category.name)}`}
                                                className="group relative block overflow-hidden rounded-lg shadow-lg h-full hover:shadow-brand-primary/20 transition-shadow duration-300"
                                            >
                                                <img
                                                    src={category.image || getRandomImage()}
                                                    alt={`Colección de souvenirs para ${category.name}`}
                                                    className="w-full h-72 object-cover transform group-hover:scale-105 transition-transform duration-300"
                                                />
                                                <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center p-4 text-center">
                                                    <h3 className="text-2xl font-serif font-bold text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">{category.name}</h3>
                                                    <p className="text-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mt-2">Ver colección</p>
                                                </div>
                                            </Link>
                                        </motion.div>
                                    ))}
                                </motion.div>
                                {/* Mobile Carousel */}
                                <div className="lg:hidden">
                                    <Swiper
                                        modules={[Pagination, Navigation]}
                                        pagination={{ clickable: true }}
                                        navigation
                                        spaceBetween={20}
                                        slidesPerView={1.2}
                                        breakpoints={{
                                            640: {
                                                slidesPerView: 2.2,
                                                spaceBetween: 20,
                                            },
                                        }}
                                    >
                                        {categories.map((category) => (
                                            <SwiperSlide key={category.id}>
                                                <Link
                                                    to={company ? `/${company.slug}/catalogo?category=${encodeURIComponent(category.name)}` : `/catalogo?category=${encodeURIComponent(category.name)}`}
                                                    className="group relative block overflow-hidden rounded-lg shadow-lg h-full"
                                                >
                                                    <img
                                                        src={category.image || getRandomImage()}
                                                        alt={`Colección de souvenirs para ${category.name}`}
                                                        className="w-full h-72 object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center p-4 text-center">
                                                        <h3 className="text-2xl font-serif font-bold text-white">{category.name}</h3>
                                                        <p className="text-white/80 mt-2">Ver colección</p>
                                                    </div>
                                                </Link>
                                            </SwiperSlide>
                                        ))}
                                    </Swiper>
                                </div>
                            </>
                        )}
                    </div>
                </motion.section>

                {/* Featured Products */}
                <motion.section 
                    className="py-16 sm:py-20 bg-gray-50"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                >
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-serif font-bold text-center mb-12 text-brand-text">Productos Destacados</h2>
                        {loadingProducts ? <Spinner /> : (
                            <>
                                {/* Desktop Grid */}
                                <motion.div 
                                    className="hidden lg:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8"
                                    variants={gridContainerVariants}
                                    initial="hidden"
                                    whileInView="visible"
                                    viewport={{ once: true }}
                                >
                                    {products.map(product => (
                                        <motion.div key={product.id} variants={gridItemVariants}>
                                            <ProductCard product={product} />
                                        </motion.div>
                                    ))}
                                </motion.div>
                                {/* Mobile Carousel */}
                                <div className="lg:hidden">
                                    <Swiper
                                        modules={[Pagination, Navigation]}
                                        pagination={{ clickable: true }}
                                        navigation
                                        spaceBetween={20}
                                        slidesPerView={1.2}
                                        breakpoints={{
                                            640: {
                                                slidesPerView: 2.2,
                                                spaceBetween: 20,
                                            },
                                            768: {
                                                slidesPerView: 2.5,
                                                spaceBetween: 30,
                                            },
                                        }}
                                    >
                                        {products.map(product => (
                                            <SwiperSlide key={product.id}>
                                                <ProductCard product={product} />
                                            </SwiperSlide>
                                        ))}
                                    </Swiper>
                                </div>
                            </>
                        )}
                        {!company && !loadingProducts && products.length === 0 && (
                            <div className="mt-8 text-center">
                                <p className="text-gray-500">No se encontraron productos destacados.</p>
                             </div>
                        )}
                    </div>
                </motion.section>
            </main>
        </>
    );
};

export default HomePage;