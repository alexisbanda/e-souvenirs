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

// --- Types for AI Concepts ---
interface Concept {
    name: string;
    description: string;
    materials: string[];
    imagePrompt: string;
    imageUrl?: string; // Add imageUrl property
    isGeneratingImage?: boolean; // Add isGeneratingImage property
}

// Las colecciones ahora se obtienen dinámicamente por compañía

declare const puter: any; // Declare puter object

const imagineWithPuter = (prompt: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Image generation timed out.'));
        }, 90000); // 90 seconds timeout

        const checkPuter = () => {
            if (typeof puter !== 'undefined') {
                puter.ai.txt2img(prompt)
                    .then((result: string) => {
                        clearTimeout(timeout);
                        resolve(result);
                    })
                    .catch((error: any) => {
                        clearTimeout(timeout);
                        reject(error);
                    });
            } else {
                setTimeout(checkPuter, 100); // Check again in 100ms
            }
        };
        checkPuter();
    });
};

const HomePage: React.FC = () => {
    const { company } = useCompany();
    // --- State Management ---
    const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    // --- Data Fetching for categories ---
    useEffect(() => {
        const fetchCategories = async () => {
            if (!company) {
                setCategories([]);
                setLoadingCategories(false);
                return;
            }
            setLoadingCategories(true);
            try {
                const allCategories = await getCategories();
                setCategories(allCategories.filter(cat => cat.companyId === company.id));
            } catch (error) {
                setCategories([]);
            } finally {
                setLoadingCategories(false);
            }
        };
        fetchCategories();
    }, [company]);
    
    // State for the new AI Assistant
    const [concepts, setConcepts] = useState<Concept[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [showRecaptchaNotification, setShowRecaptchaNotification] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [selectedConceptForQuote, setSelectedConceptForQuote] = useState<Concept | null>(null);

    // --- Data Fetching for featured products ---
    useEffect(() => {
        const fetchProducts = async () => {
            if (!company) {
                setFeaturedProducts([]);
                setLoadingProducts(false);
                return;
            }
            setLoadingProducts(true);
            try {
                const products = await getFeaturedProducts(company.id);
                setFeaturedProducts(products);
            } catch (error) {
                console.error("Error fetching featured products:", error);
            } finally {
                setLoadingProducts(false);
            }
        };
        fetchProducts();
    }, [company]);

    // --- AI Assistant Logic ---
    const generateImage = async (concept: Concept, index: number) => {
        try {
            // Set isGeneratingImage to true for the specific concept
            setConcepts(prevConcepts => {
                const newConcepts = [...prevConcepts];
                newConcepts[index] = { ...newConcepts[index], isGeneratingImage: true };
                return newConcepts;
            });

            const imageUrl = await imagineWithPuter(concept.imagePrompt);

            // Update the concept with the generated imageUrl
            setConcepts(prevConcepts => {
                const newConcepts = [...prevConcepts];
                newConcepts[index] = { ...newConcepts[index], imageUrl, isGeneratingImage: false };
                return newConcepts;
            });
        } catch (error) {
            console.error('Error generating image:', error);
            // Optionally handle the error, e.g., set an error state for the specific concept
            setConcepts(prevConcepts => {
                const newConcepts = [...prevConcepts];
                newConcepts[index] = { ...newConcepts[index], isGeneratingImage: false };
                return newConcepts;
            });
        }
    };

    const handleSubmit = async (prompt: string, baseConcept?: Concept) => {
        if (!prompt.trim()) return;

        if (!hasSearched) {
            setShowRecaptchaNotification(true);
        }

        setIsLoading(true);
        setError(null);
        setHasSearched(true);
        setConcepts([]); // Clear previous concepts

        try {
            const response = await fetch('/.netlify/functions/generateConcepts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userInput: prompt,
                    baseConcept,
                    companySettings: company ? {
                        aiPrompt: company.settings?.aiPrompt,
                        name: company.name,
                    } : undefined,
                }),
            });

            if (!response.ok) {
                throw new Error('La IA no pudo generar una respuesta. Inténtalo de nuevo.');
            }

            const data = await response.json();
            const newConcepts = data.concepts || [];
            setConcepts(newConcepts);

            // Generate images for the new concepts
            newConcepts.forEach((concept: Concept, index: number) => {
                generateImage(concept, index);
            });

        } catch (err: any) {
            setError(err.message || 'Ocurrió un error inesperado.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVariationSubmit = (baseConcept: Concept) => {
        const prompt = `Genera 3 NUEVAS variaciones de este concepto: ${JSON.stringify(baseConcept)}.`;
        handleSubmit(prompt, baseConcept);
    }

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "e-Souvenirs AI Assistant",
        "url": "http://localhost:3000",
        "logo": "http://localhost:3000/logo.png"
    };

    // Prepara las categorías como eventTypes para el wizard
    const eventTypes: CategoryOption[] = categories.map(cat => ({ name: cat.name, icon: cat.icon }));

    // Filtra las categorías destacadas para la sección de colecciones
    const featuredCategories = categories.filter(cat => cat.featured);

    return (
        <>
            <title>Recuerdos Artesanales | Asistente de IA para Souvenirs</title>
            <meta name="description" content="Describe tu idea o evento y deja que nuestra IA cree conceptos de souvenirs únicos y personalizados para ti. Tu recuerdo perfecto empieza aquí." />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
            />
            <main>
                {/* --- Image Modal --- */}
                {selectedImageUrl && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setSelectedImageUrl(null)}>
                        <div className="relative">
                            <img src={selectedImageUrl} alt="Imagen en alta resolución" className="max-w-screen-xl max-h-screen-xl"/>
                            <button onClick={() => setSelectedImageUrl(null)} className="absolute top-0 right-0 mt-4 mr-4 text-white text-2xl font-bold">&times;</button>
                        </div>
                    </div>
                )}

                {/* --- Quote Modal --- */}
                {selectedConceptForQuote && (
                    <QuoteModal concept={selectedConceptForQuote} onClose={() => setSelectedConceptForQuote(null)} />
                )}

                {/* --- New AI-Powered Hero Section --- */}
                <section className="relative py-20 md:py-32 min-h-[70vh] flex items-center justify-center text-white bg-gray-800">
                    <div className="absolute inset-0">
                        <img
                            src={company?.settings?.heroImage?.trim() ? company.settings.heroImage : "https://picsum.photos/seed/hero-ai/1600/900"}
                            alt="Fondo abstracto de creatividad y diseño"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60"></div>
                    </div>
                    <div className="relative z-10 container mx-auto px-4 text-center">
                        <h1 className="text-4xl tracking-tight font-extrabold sm:text-5xl md:text-6xl">
                            <span className="block font-serif">¿No sabes qué regalar?</span>
                            <span className="block font-serif" style={{ color: 'var(--brand-primary)' }}>Díselo a nuestra IA.</span>
                        </h1>
                        <p className="mt-4 max-w-2xl mx-auto text-xl text-white/90">
                            Describe tu evento, tu idea o lo que sientes, y nuestro asistente creativo diseñará un souvenir único solo para ti.
                        </p>
                        <div className="mt-10">
                            <IdeaWizard onSubmit={handleSubmit} eventTypes={eventTypes} />
                        </div>
                    </div>
                </section>

                {/* --- AI Results Section --- */}
                {hasSearched && (
                    <section id="ai-results" className="py-16 bg-white">
                        <div className="container mx-auto px-4">
                            {showRecaptchaNotification && (
                                <div className="container mx-auto px-4 mb-8">
                                    <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4" role="alert">
                                        <p className="font-bold">¡Atención!</p>
                                        <p>La primera vez que generes imágenes, es posible que se te pida completar un reCAPTCHA para verificar que no eres un robot. Por favor, completa la verificación para continuar.</p>
                                    </div>
                                </div>
                            )}
                            {isLoading && <div className="flex justify-center"><Spinner /></div>}
                            {error && <p className="text-center text-red-500">{error}</p>}
                            {concepts.length > 0 && (
                                <div className="text-center mb-12">
                                    <h2 className="text-3xl font-serif font-bold" style={{ color: 'var(--brand-text)' }}>Conceptos Creados para Ti</h2>
                                    <p className="text-lg mt-2">Aquí tienes 3 ideas únicas generadas por nuestra IA, basadas en tu petición.</p>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {concepts.map((concept, index) => (
                                    <div key={index} className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow overflow-hidden flex flex-col group">
                                        <div className="w-full h-48 bg-gray-200 flex items-center justify-center cursor-pointer overflow-hidden" onClick={() => concept.imageUrl && setSelectedImageUrl(concept.imageUrl)}>
                                            {concept.isGeneratingImage ? (
                                                <Spinner />
                                            ) : concept.imageUrl ? (
                                                <img src={concept.imageUrl} alt={concept.name} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300"/>
                                            ) : (
                                                <div className="text-gray-500">No se pudo generar la imagen</div>
                                            )}
                                        </div>
                                        <div className="p-6 flex flex-col flex-grow">
                                            <h3 className="text-2xl font-serif font-bold" style={{ color: 'var(--brand-primary)' }}>{concept.name}</h3>
                                            <p className="mt-2 text-gray-600 flex-grow">{concept.description}</p>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {concept.materials.map(material => (
                                                    <span key={material} className="px-3 py-1 text-sm font-medium rounded-full" style={{ background: 'var(--brand-secondary)', color: 'var(--brand-text)', opacity: 0.8 }}>{material}</span>
                                                ))}
                                            </div>
                                            <div className="mt-6 grid grid-cols-1 gap-3">
                                                <button onClick={() => setSelectedConceptForQuote(concept)} className="w-full text-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white" style={{ background: 'var(--brand-primary)' }}>
                                                    Me Interesa / Solicitar Cotización
                                                </button>
                                                <button onClick={() => handleVariationSubmit(concept)} disabled={isLoading} className="w-full text-center px-6 py-3 border text-base font-medium rounded-md" style={{ color: 'var(--brand-text)', borderColor: 'var(--brand-secondary)', background: 'white' }}>
                                                    {isLoading ? 'Generando...' : 'Generar Variaciones'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* Featured Collections */}
                <section className="bg-brand-secondary/30 py-16">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-serif font-bold text-center mb-12" style={{ color: 'var(--brand-text)' }}>O Explora Nuestras Colecciones</h2>
                        {loadingCategories ? (
                            <div className="flex justify-center"><Spinner /></div>
                        ) : featuredCategories.length === 0 ? (
                            <p className="text-center text-gray-500">No hay colecciones destacadas configuradas para esta compañía.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                {featuredCategories.map(category => (
                                    <Link
                                        to={company ? `/${company.slug}/catalogo?category=${encodeURIComponent(category.name)}` : `/catalogo?category=${encodeURIComponent(category.name)}`}
                                        key={category.id}
                                        className="group relative block"
                                    >
                                        <div className="overflow-hidden rounded-lg">
                                            <img
                                                src={category.image || 'https://picsum.photos/seed/category-default/600/400'}
                                                alt={`Colección de recuerdos para ${category.name}`}
                                                className="w-full h-64 object-cover transform group-hover:scale-105 transition-transform duration-300"
                                            />
                                        </div>
                                        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                                            <h3 className="text-2xl font-serif font-bold" style={{ color: 'var(--brand-primary)' }}>{category.name}</h3>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Featured Products */}
                <section className="py-16 bg-gray-50">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-serif font-bold text-center mb-12" style={{ color: 'var(--brand-text)' }}>Productos Destacados</h2>
                        {loadingProducts ? <Spinner /> : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                                {featuredProducts.map(product => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </div>
                        )}
                        {!company && !loadingProducts && featuredProducts.length === 0 && (
                            <p className="text-center text-gray-500 mt-8">
                                No se ha especificado una empresa. Por favor, visita la página de una empresa para ver sus productos, por ejemplo: <Link to="/recuerdos-artesanales" className="text-blue-500">/recuerdos-artesanales</Link>
                            </p>
                        )}
                    </div>
                </section>
            </main>
        </>
    );
};

export default HomePage;