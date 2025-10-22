import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const RegistrationSuccessPage: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => {
            navigate('/admin');
        }, 4000); // Redirige después de 4 segundos

        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
            <motion.div
                className="text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <CheckCircleIcon className="w-24 h-24 text-green-400 mx-auto mb-6" />
                <h1 className="text-4xl font-bold mb-4">¡Registro Exitoso!</h1>
                <p className="text-slate-300 text-lg mb-2">Tu empresa ha sido registrada y está pendiente de aprobación.</p>
                <p className="text-slate-400">Serás redirigido al panel de administración en unos segundos...</p>
            </motion.div>
        </div>
    );
};

export default RegistrationSuccessPage;
