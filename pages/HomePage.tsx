import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFeaturedProducts } from '../services/productService';
import { Product, Category } from '../types';
import { getCategories } from '../services/categoryService';
import { useCompany } from '../context/CompanyContext';
import ProductCard from '../components/ProductCard';
import Spinner from '../components/Spinner';
import QuoteModal from '../components/QuoteModal';
import IdeaWizard, { CategoryOption } from '../components/IdeaWizard';
import { motion } from 'framer-motion';
import ConceptCardSkeleton from '../components/ConceptCardSkeleton';

// Extend the Window interface to include Google Analytics
declare global {
    interface Window {
        ga?: (command: string, ...fields: any[]) => void;
    }
}

// --- Types for AI Concepts ---
interface Concept {
    name: string;
    description: string;
    materials: string[];
    imageUrl?: string;
    isGeneratingImage?: boolean;
}

const HomePage: React.FC = () => {
    const { company } = useCompany();
    // --- State Management ---
    const [eventTypes, setEventTypes] = useState<CategoryOption[]>([]);
    const [concepts, setConcepts] = useState<Concept[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [showRecaptchaNotification, setShowRecaptchaNotification] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [selectedConceptForQuote, setSelectedConceptForQuote] = useState<Concept | null>(null);

    // --- Animation Variants ---
    const sectionVariants = {
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

    const handleSubmit = async (prompt: string, baseConcept?: Concept) => {
        setIsLoading(true);
        setError(null);
        setShowRecaptchaNotification(false);

        try {
            const response = await fetch('/.netlify/functions/generateConcepts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userInput: prompt, companyId: company?.id, baseConcept }),
            });

            if (!response.ok) {
                throw new Error('Error en la generación de conceptos');
            }

            const data = await response.json();
            setConcepts(data.concepts);
            setHasSearched(true);

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

    const handleVariationSubmit = (baseConcept: Concept) => {
        const prompt = `Genera 3 NUEVAS variaciones de este concepto: ${JSON.stringify(baseConcept)}.`;
        handleSubmit(prompt, baseConcept);
    };

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Home",
        description: "Página principal de Recuerdos Artesanales, donde puedes encontrar souvenirs únicos generados por IA.",
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
            <title>Recuerdos Artesanales | Asistente de IA para Souvenirs</title>
            <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
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
                <section className="relative py-20 md:py-32 min-h-[70vh] flex items-center justify-center text-white bg-gray-900 overflow-hidden">
                    <div className="absolute inset-0">
                        <motion.img
                            src={company?.settings?.heroImage?.trim() ? company.settings.heroImage : "https://picsum.photos/seed/hero-ai/1600/900"}
                            alt="Fondo abstracto de creatividad y diseño"
                            className="w-full h-full object-cover"
                            initial={{ scale: 1.1 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 15, ease: "linear", repeat: Infinity, repeatType: "mirror" }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-black/60 to-transparent"></div>
                    </div>
                    <div className="relative z-10 container mx-auto px-4 text-center">
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
                            className="mt-4 max-w-2xl mx-auto text-xl text-white/90"
                            variants={heroSubtitleVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            Describe tu evento, tu idea o lo que sientes, y nuestro asistente creativo diseñará un souvenir único solo para ti.
                        </motion.p>
                        <motion.div 
                            className="mt-10"
                            variants={wizardVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            <IdeaWizard onSubmit={handleSubmit} eventTypes={eventTypes} isLoading={isLoading} />
                        </motion.div>
                    </div>
                </section>

                {/* --- AI Results Section --- */}
                {hasSearched && (
                    <motion.section 
                        id="ai-results" 
                        className="py-20 bg-gray-900 text-white relative overflow-hidden"
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
                                {isLoading && concepts.length === 0 ? (
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
                                                    <button onClick={() => handleVariationSubmit(concept)} disabled={isLoading} className="w-full text-center px-6 py-3 border border-white/20 text-base font-medium rounded-md text-white bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50">
                                                        {isLoading ? 'Generando...' : 'Generar Variaciones'}
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

                {/* Featured Collections */}
                <motion.section 
                    className="bg-brand-secondary/30 py-20"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                >
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-serif font-bold text-center mb-12 text-brand-text">O Explora Nuestras Colecciones</h2>
                        {loadingCategories ? (
                            <div className="flex justify-center"><Spinner /></div>
                        ) : featuredCategories.length === 0 ? (
                            <p className="text-center text-gray-500">No hay colecciones destacadas configuradas para esta compañía.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                {featuredCategories.map((category, index) => (
                                    <motion.div
                                        key={category.id}
                                        variants={sectionVariants}
                                        initial="hidden"
                                        whileInView="visible"
                                        viewport={{ once: true, amount: 0.3 }}
                                        transition={{ delay: index * 0.1 }}
                                    >
                                        <Link
                                            to={company ? `/${company.slug}/catalogo?category=${encodeURIComponent(category.name)}` : `/catalogo?category=${encodeURIComponent(category.name)}`}
                                            className="group relative block overflow-hidden rounded-lg shadow-lg"
                                        >
                                            <img
                                                src={category.image || 'https://picsum.photos/seed/category-default/600/400'}
                                                alt={`Colección de recuerdos para ${category.name}`}
                                                className="w-full h-72 object-cover transform group-hover:scale-105 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center p-4 text-center">
                                                <h3 className="text-2xl font-serif font-bold text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">{category.name}</h3>
                                                <p className="text-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mt-2">Ver colección</p>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.section>

                {/* Featured Products */}
                <motion.section 
                    className="py-20 bg-gray-50"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                >
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-serif font-bold text-center mb-12 text-brand-text">Productos Destacados</h2>
                        {loadingProducts ? <Spinner /> : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                                {products.map(product => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </div>
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