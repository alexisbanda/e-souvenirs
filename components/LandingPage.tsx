import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { TypeAnimation } from 'react-type-animation';
import { FiPenTool, FiStore, FiBarChart2 } from 'react-icons/fi';
import { ArrowRightIcon, SparklesIcon, ShoppingBagIcon, PencilSquareIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { db } from '../services/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Company } from '../types/company';
import { BuildingStorefrontIcon, CheckIcon } from '@heroicons/react/24/solid';
import { PricingPlan } from '../types/pricing';
import { defaultHeroImages } from '../utils/constants';

const pricingPlans: PricingPlan[] = [
    {
        name: "Básico",
        price: "9",
        features: [
            "Tienda online en subdominio",
            "Hasta 50 productos",
            "3 fotos por producto",
            "Descripciones generadas por IA",
            "Mailing básico",
            "Cero comisiones por venta",
        ],
        isFeatured: false,
    },
    {
        name: "Pro",
        price: "29",
        features: [
            "Todo lo del plan Básico",
            "Productos ilimitados",
            "Fotos ilimitadas por producto",
            "Dominio personalizado",
            "Descripciones e imágenes generadas por IA",
            "Mailing Pro",
            "Soporte prioritario",
        ],
        isFeatured: true,
    },
    {
        name: "Enterprise",
        price: "Custom",
        features: [
            "Todo lo del plan Pro",
            "Funcionalidades a medida",
            "Gestor de cuenta dedicado",
            "Integraciones avanzadas (API)",
            "Soporte 24/7",
        ],
        isFeatured: false,
    },
];

const LandingPage: React.FC = () => {
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
            <main className="bg-slate-900 text-gray-300 font-sans">
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
                                alt="Taller de un artesano con diversas herramientas y creaciones."
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
                            De <TypeAnimation
                                sequence={[
                                    'Artesano',
                                    1500,
                                    'Emprendedor',
                                    1500,
                                    'Comerciante',
                                    1500,
                                    'Vendedor',
                                    1500,
                                ]}
                                wrapper="span"
                                speed={50}
                                className="text-highlight"
                                repeat={Infinity}
                                /> a <span className="text-brand-primary">Empresario Digital</span>: <br />
                            Tu Tienda Online en <span className="text-brand-primary">Minutos</span>
                        </motion.h1>
                        <motion.p 
                            className="text-lg md:text-xl mb-12 max-w-3xl mx-auto text-white/80"
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4, duration: 0.7, ease: "easeOut" }}
                        >
                            <span className="text-brand-primary">Crea</span>, <span className="text-brand-primary">vende</span> y <span className="text-brand-primary">haz crecer</span> tu marca con nuestra plataforma <span className="text-brand-primary">todo-en-uno</span>. Sin comisiones, sin límites.
                        </motion.p>
                        <motion.div
                            className="flex flex-col sm:flex-row items-center justify-center gap-6"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.6, duration: 0.5, ease: "easeOut" }}
                        >
                            <Link to="/register-company" className="group bg-brand-primary text-white font-bold py-4 px-10 rounded-full hover:bg-brand-primary/90 transition-all duration-300 text-lg shadow-lg hover:shadow-brand-primary/40 transform hover:-translate-y-1 inline-flex items-center gap-3">
                                Lanzar mi Tienda <ArrowRightIcon className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>
                            <a
                                href="#pricing"
                                onClick={(e) => {
                                    e.preventDefault();
                                    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="group bg-transparent border-2 border-white text-white font-bold py-4 px-10 rounded-full hover:bg-white hover:text-slate-900 transition-all duration-300 text-lg transform hover:-translate-y-1 inline-flex items-center gap-3"
                            >
                                Ver Planes
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
                        <h2 className="text-4xl font-bold text-center mb-20 text-white tracking-tight">Todo lo que tu Negocio Necesita para Vender Online</h2>
                        <div className="grid md:grid-cols-3 gap-12 text-center">
                            <motion.div className="p-8 bg-slate-800/60 rounded-2xl transition-all duration-300 border border-slate-700/80" whileHover={{ y: -8, background: 'rgb(30 41 59 / 0.8)', borderColor: '#475569' }}>
                                <SparklesIcon className="w-12 h-12 text-brand-primary mx-auto mb-5" />
                                <h3 className="text-2xl font-bold mb-3 text-white">Crea Productos al Instante</h3>
                                <p className="text-gray-400">¿Sin diseños? Describe una idea y nuestra IA puede generar productos y merchandising para tu marca. Amplía tu catálogo sin esfuerzo.</p>
                            </motion.div>
                            <motion.div className="p-8 bg-slate-800/60 rounded-2xl transition-all duration-300 border border-slate-700/80" whileHover={{ y: -8, background: 'rgb(30 41 59 / 0.8)', borderColor: '#475569' }}>
                                <ShoppingBagIcon className="w-12 h-12 text-brand-primary mx-auto mb-5" />
                                <h3 className="text-2xl font-bold mb-3 text-white">Vende Sin Comisiones</h3>
                                <p className="text-gray-400">A diferencia de los marketplaces, tu tienda es 100% tuya. No pagas comisiones por venta, lo que significa que todas las ganancias se quedan en tu bolsillo.</p>
                            </motion.div>
                            <motion.div className="p-8 bg-slate-800/60 rounded-2xl transition-all duration-300 border border-slate-700/80" whileHover={{ y: -8, background: 'rgb(30 41 59 / 0.8)', borderColor: '#475569' }}>
                                <FiBarChart2 className="text-4xl text-brand-primary mx-auto mb-5" />
                                <h3 className="text-2xl font-bold mb-3 text-white">Administra Todo en un Solo Lugar</h3>
                                <p className="text-gray-400">Gestiona inventario, procesa pedidos y revisa tus ganancias desde un panel de control intuitivo. Menos tiempo administrando, más tiempo haciendo crecer tu negocio.</p>
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
                                <img src="https://images.unsplash.com/photo-1628348723340-2fb9ec19753b?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=735" alt="Exhibición de productos artesanales en una tienda" className="rounded-2xl shadow-2xl w-full h-auto object-cover"/>                            </div>
                            <div className="md:col-span-3">
                                <h2 className="text-4xl font-bold mb-12 text-white tracking-tight">Tu Lanzamiento en 3 Simples Pasos</h2>
                                <ul className="space-y-10">
                                    <li className="flex items-start">
                                        <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-xl bg-slate-800 text-brand-primary border-2 border-slate-700">
                                            <PencilSquareIcon className="w-8 h-8" />
                                        </div>
                                        <div className="ml-6">
                                            <h3 className="text-xl font-bold text-white">1. Crea y Personaliza tu Tienda</h3>
                                            <p className="text-gray-400 mt-2">Regístrate en minutos, sube tu logo y elige los colores de tu marca. Tu tienda online tomará forma al instante, sin necesidad de un diseñador.</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start">
                                        <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-xl bg-slate-800 text-brand-primary border-2 border-slate-700">
                                            <SparklesIcon className="w-8 h-8" />
                                        </div>
                                        <div className="ml-6">
                                            <h3 className="text-xl font-bold text-white">2. Sube tus Productos</h3>
                                            <p className="text-gray-400 mt-2">Añade tus productos con fotos, descripciones y precios. Nuestra plataforma es flexible para que vendas cualquier tipo de artículo, desde productos físicos hasta digitales.</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start">
                                        <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-xl bg-slate-800 text-brand-primary border-2 border-slate-700">
                                            <GlobeAltIcon className="w-8 h-8" />
                                        </div>
                                        <div className="ml-6">
                                            <h3 className="text-xl font-bold text-white">3. Empieza a Vender</h3>
                                            <p className="text-gray-400 mt-2">Activa tu tienda con un solo clic y comienza a aceptar pagos de forma segura. Estás listo para recibir a tus primeros clientes y gestionar tus pedidos fácilmente.</p>
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
                        <h2 className="text-4xl font-bold text-center mb-4 text-white tracking-tight">Planes Simples y Transparentes</h2>
                        <p className="text-lg text-gray-400 text-center mb-20 max-w-3xl mx-auto">
                            Elige el plan que se adapte a tu crecimiento. Sin comisiones ocultas. Nunca.
                        </p>
                        <div className="flex flex-col md:flex-row justify-center items-center gap-8 max-w-4xl mx-auto">
                            {pricingPlans.map((plan) => (
                                <div key={plan.name} className={`relative w-full p-8 rounded-2xl border ${plan.isFeatured ? 'border-brand-primary/80 bg-slate-800' : 'border-slate-700 bg-slate-800/60'}`}>
                                    {plan.isFeatured && (
                                        <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2">
                                            <span className="bg-brand-primary text-white text-xs font-bold px-4 py-1 rounded-full uppercase">Más Popular</span>
                                        </div>
                                    )}
                                    <h3 className="text-2xl font-bold text-white text-center mb-2">{plan.name}</h3>
                                    <div className="text-center mb-8">
                                        {plan.price === "Custom" ? (
                                            <span className="text-4xl font-extrabold text-white">A Medida</span>
                                        ) : (
                                            <>
                                                <span className="text-4xl font-extrabold text-white">${plan.price}</span>
                                                <span className="text-lg text-gray-400">/mes</span>
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
                                    {plan.price !== "Custom" ? (
                                        <Link
                                            to="/register-company"
                                            className={`w-full text-center font-bold py-3 px-6 rounded-lg transition-all duration-300 ${plan.isFeatured ? 'bg-brand-primary text-white hover:bg-brand-primary/90' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                                        >
                                            Empezar Ahora
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
                                            Contactar a Ventas
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
                            <h2 className="text-4xl font-bold mb-4 text-white tracking-tight">Impulsando a Negocios como el Tuyo</h2>
                            <p className="text-lg text-gray-400 mb-20 max-w-3xl mx-auto">
                                Desde pequeños comerciantes hasta marcas en crecimiento, nuestra plataforma es el motor de nuevas historias de éxito.
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
                        <h2 className="text-4xl font-bold text-center mb-4 text-white tracking-tight">Contacta con Ventas</h2>
                        <p className="text-lg text-gray-400 text-center mb-12 max-w-3xl mx-auto">
                            ¿Tienes requerimientos especiales? Nuestro equipo está listo para ayudarte a crear un plan a tu medida.
                        </p>
                        <div className="max-w-2xl mx-auto">
                            <form name="contact-enterprise" method="POST" data-netlify="true" netlify-honeypot="bot-field">
                                <input type="hidden" name="form-name" value="contact-enterprise" />
                                <div className="hidden">
                                    <label>Don’t fill this out if you’re human: <input name="bot-field" /></label>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">Nombre</label>
                                        <input type="text" name="name" id="name" required className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-brand-primary focus:border-brand-primary" />
                                    </div>
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                                        <input type="email" name="email" id="email" required className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-brand-primary focus:border-brand-primary" />
                                    </div>
                                </div>
                                <div className="mb-6">
                                    <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-2">Empresa (Opcional)</label>
                                    <input type="text" name="company" id="company" className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-brand-primary focus:border-brand-primary" />
                                </div>
                                <div className="mb-6">
                                    <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">Mensaje</label>
                                    <textarea name="message" id="message" rows={5} required className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-brand-primary focus:border-brand-primary"></textarea>
                                </div>
                                <div className="text-center">
                                    <button type="submit" className="bg-brand-primary text-white font-bold py-3 px-10 rounded-full hover:bg-brand-primary/90 transition-all duration-300 text-lg shadow-lg hover:shadow-brand-primary/40">
                                        Enviar Mensaje
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
                        <h2 className="text-5xl font-extrabold mb-6 tracking-tighter">¿Listo para Vender Online y Hacer Crecer tu Negocio?</h2>
                        <p className="text-xl mb-12 text-white/70">Miles de pequeños negocios ya venden por internet. No te quedes atrás.</p>
                        <Link to="/register-company" className="group bg-white text-slate-900 font-bold py-4 px-10 rounded-full hover:bg-gray-200 transition-all duration-300 text-lg shadow-lg hover:shadow-white/20 transform hover:-translate-y-1 inline-flex items-center gap-3">
                            Crear mi Tienda Online <ArrowRightIcon className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                        </Link>
                    </div>
                </motion.section>
            </main>
        </>
    );
};

export default LandingPage;
    