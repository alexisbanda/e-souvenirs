import React, { useState } from 'react';

interface Concept {
    name: string;
    description: string;
    materials: string[];
    imagePrompt: string;
    imageUrl?: string;
}

interface QuoteModalProps {
    concept: Concept;
    onClose: () => void;
}

export const QuoteModal: React.FC<QuoteModalProps> = ({ concept, onClose }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [quantity, setQuantity] = useState(1);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Aquí se manejaría el envío de la cotización
        console.log({ name, email, quantity, concept });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg max-w-md w-full">
                <h2 className="text-2xl font-bold mb-4">Solicitar Cotización</h2>
                <p className="mb-2"><strong>Concepto:</strong> {concept.name}</p>
                <p className="mb-4"><strong>Descripción:</strong> {concept.description}</p>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre</label>
                        <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Cantidad</label>
                        <input type="number" id="quantity" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" min="1" required />
                    </div>
                    <div className="flex justify-end">
                        <button type="button" onClick={onClose} className="mr-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Cancelar</button>
                        <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Solicitar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default QuoteModal;