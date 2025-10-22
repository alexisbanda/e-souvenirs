import React from 'react';
import { Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { FiPenTool, FiStore, FiBarChart2 } from 'react-icons/fi';
import { ArrowRightIcon, SparklesIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';

const LandingPage: React.FC = () => {
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
            <title>Recuerdos Artesanales | Transforma Arte en Negocio</title>
            <main className="bg-slate-900 text-gray-300 font-sans">
                {/* Hero Section */}
                <motion.section 
                    className="relative text-white text-center py-32 md:py-48 overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="absolute inset-0">
                        <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80" alt="Boutique de ropa elegante" className="w-full h-full object-cover"/>
                        <div className="absolute inset-0 bg-slate-900/70 bg-gradient-to-t from-slate-900 via-transparent"></div>
                    </div>
                    <div className="container mx-auto px-6 relative z-10">
                        <motion.h1 
                            className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tighter"
                            initial={{ y: -30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.7, ease: "easeOut" }}
                        >
                            El Arte de Crear. La Ciencia de Vender.
                        </motion.h1>
                        <motion.p 
                            className="text-lg md:text-xl mb-12 max-w-3xl mx-auto text-white/80"
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4, duration: 0.7, ease: "easeOut" }}
                        >
                            Tu talento es único. Nuestra IA lo convierte en un negocio global. Diseña, vende y escala tu marca de souvenirs sin límites.
                        </motion.p>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.6, duration: 0.5, ease: "easeOut" }}
                        >
                            <Link to="/register-company" className="group bg-brand-primary text-white font-bold py-4 px-10 rounded-full hover:bg-brand-primary/90 transition-all duration-300 text-lg shadow-lg hover:shadow-brand-primary/40 transform hover:-translate-y-1 inline-flex items-center gap-3">
                                Inicia tu Imperio Creativo <ArrowRightIcon className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>
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
                        <h2 className="text-4xl font-bold text-center mb-20 text-white tracking-tight">Donde la Inspiración se Encuentra con la Innovación</h2>
                        <div className="grid md:grid-cols-3 gap-12 text-center">
                            <motion.div className="p-8 bg-slate-800/60 rounded-2xl transition-all duration-300 border border-slate-700/80" whileHover={{ y: -8, background: 'rgb(30 41 59 / 0.8)', borderColor: '#475569' }}>
                                <SparklesIcon className="w-12 h-12 text-brand-primary mx-auto mb-5" />
                                <h3 className="text-2xl font-bold mb-3 text-white">Diseño Asistido por IA</h3>
                                <p className="text-gray-400">Convierte una simple idea en una colección de productos. Nuestro asistente inteligente es tu co-creador, no solo una herramienta.</p>
                            </motion.div>
                            <motion.div className="p-8 bg-slate-800/60 rounded-2xl transition-all duration-300 border border-slate-700/80" whileHover={{ y: -8, background: 'rgb(30 41 59 / 0.8)', borderColor: '#475569' }}>
                                <ShoppingBagIcon className="w-12 h-12 text-brand-primary mx-auto mb-5" />
                                <h3 className="text-2xl font-bold mb-3 text-white">Tu Propia Tienda, Cero Comisiones</h3>
                                <p className="text-gray-400">Tu marca, tus reglas. Lanza una tienda online profesional que refleje tu identidad y quédate con el 100% de tus ganancias.</p>
                            </motion.div>
                            <motion.div className="p-8 bg-slate-800/60 rounded-2xl transition-all duration-300 border border-slate-700/80" whileHover={{ y: -8, background: 'rgb(30 41 59 / 0.8)', borderColor: '#475569' }}>
                                <FiBarChart2 className="text-4xl text-brand-primary mx-auto mb-5" />
                                <h3 className="text-2xl font-bold mb-3 text-white">Gestión Simplificada</h3>
                                <p className="text-gray-400">Un centro de control intuitivo para tus pedidos, clientes y métricas. Menos administración, más creación.</p>
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
                        <div className="grid md:grid-cols-2 gap-16 items-center">
                            <div className="relative">
                                <img src="https://plus.unsplash.com/premium_photo-1679868096270-2d64f57434a3?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTN8fHNvdXZlbmlyc3xlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&q=60&w=500" alt="Exhibición de productos artesanales en una tienda" className="rounded-2xl shadow-2xl w-full h-auto object-cover"/>
                            </div>
                            <div>
                                <h2 className="text-4xl font-bold mb-8 text-white tracking-tight">Tu Lanzamiento en Minutos</h2>
                                <ul className="space-y-8">
                                    <li className="flex items-start">
                                        <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-brand-primary text-xl font-bold border-2 border-slate-700">1</div>
                                        <div className="ml-6">
                                            <h3 className="text-xl font-bold text-white">Crea tu Espacio</h3>
                                            <p className="text-gray-400 mt-1">Regístrate y obtén acceso instantáneo a tu estudio digital personalizado.</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start">
                                        <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-brand-primary text-xl font-bold border-2 border-slate-700">2</div>
                                        <div className="ml-6">
                                            <h3 className="text-xl font-bold text-white">Desata la Magia con IA</h3>
                                            <p className="text-gray-400 mt-1">Usa nuestro asistente para generar diseños únicos y configurar tu tienda sin esfuerzo.</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start">
                                        <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-brand-primary text-xl font-bold border-2 border-slate-700">3</div>
                                        <div className="ml-6">
                                            <h3 className="text-xl font-bold text-white">Conquista el Mundo</h3>
                                            <p className="text-gray-400 mt-1">Lanza tu tienda, procesa pagos y gestiona pedidos para una audiencia global.</p>
                                        </div>
                                    </li>
                                </ul>
                            </div>
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
                        <h2 className="text-5xl font-extrabold mb-6 tracking-tighter">¿Listo para ser el próximo gran nombre en souvenirs?</h2>
                        <p className="text-xl mb-12 text-white/70">No esperes a que te descubran. Constrúyete un nombre.</p>
                        <Link to="/register-company" className="group bg-white text-slate-900 font-bold py-4 px-10 rounded-full hover:bg-gray-200 transition-all duration-300 text-lg shadow-lg hover:shadow-white/20 transform hover:-translate-y-1 inline-flex items-center gap-3">
                            Reclamar mi Tienda <ArrowRightIcon className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                        </Link>
                    </div>
                </motion.section>
            </main>
        </>
    );
};

export default LandingPage;
