import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getQuoteById, updateQuote } from '../../services/quoteService'; // These functions need to be created
import { Quote, QuoteStatus } from '../../types/quote'; // Status enum needs to be added to the type
import Spinner from '../../components/Spinner';

const getStatusColor = (status: QuoteStatus) => {
    switch (status) {
        case 'Pendiente': return 'bg-gray-100 text-gray-800';
        case 'Contactado': return 'bg-blue-100 text-blue-800';
        case 'En negociación': return 'bg-yellow-100 text-yellow-800';
        case 'Ganada': return 'bg-green-100 text-green-800';
        case 'Perdida': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const QuoteDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [quote, setQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<QuoteStatus |''>('');
    const [observations, setObservations] = useState('');

    useEffect(() => {
        if (id) {
            getQuoteById(id)
                .then(quote => {
                    if (quote) {
                        setQuote(quote);
                        setStatus(quote.status || '');
                        setObservations(quote.observations || '');
                    }
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        }
    }, [id]);

    const handleUpdate = async () => {
        if (id && (status || observations)) {
            await updateQuote(id, { status, observations });
            const updatedQuote = await getQuoteById(id);
            if (updatedQuote) {
                setQuote(updatedQuote);
            }
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><Spinner /></div>;
    }

    if (!quote) {
        return <div className="text-center py-12">Cotización no encontrada.</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Detalle de la Cotización</h1>
                <Link to="/admin/quotes" className="text-blue-500 hover:underline">Volver a la lista</Link>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                        <h2 className="text-2xl font-semibold mb-4">Información del Cliente</h2>
                        <p><strong>Nombre:</strong> {quote.name}</p>
                        <p><strong>Email:</strong> {quote.email}</p>
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold mb-4">Información de la Cotización</h2>
                        <p><strong>Concepto:</strong> {quote.concept.name}</p>
                        <p><strong>Descripción:</strong> {quote.concept.description}</p>
                        <p><strong>Cantidad:</strong> {quote.quantity}</p>
                        <p><strong>Fecha:</strong> {quote.createdAt ? new Date(quote.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
                        <div className="flex items-center mt-2">
                            <strong>Estado:</strong> 
                            <span className={`ml-2 text-sm font-medium px-2.5 py-0.5 rounded-full ${getStatusColor(quote.status)}`}>
                                {quote.status}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">Actualizar Cotización</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Estado</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus)} className="mt-1 block w-full border rounded-md p-2">
                                <option value="Pendiente">Pendiente</option>
                                <option value="Contactado">Contactado</option>
                                <option value="En negociación">En negociación</option>
                                <option value="Ganada">Ganada</option>
                                <option value="Perdida">Perdida</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Observaciones</label>
                            <textarea 
                                value={observations}
                                onChange={(e) => setObservations(e.target.value)}
                                className="mt-1 block w-full border rounded-md p-2"
                                rows={3}
                            />
                        </div>
                    </div>
                    <button onClick={handleUpdate} className="mt-4 bg-blue-500 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600">
                        Actualizar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuoteDetailPage;
