import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getQuotes } from '../../services/quoteService';
import { Quote } from '../../types/quote';
import Spinner from '../../components/Spinner';
import { useAuth } from '../../context/AuthContext';
import { getCompanies } from '../../services/companyService';

const QuoteListPage: React.FC = () => {
    const { user } = useAuth();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [companies, setCompanies] = useState<{ id: string, name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCompany, setSelectedCompany] = useState('all');
    const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);

    useEffect(() => {
        if (user) {
            fetchQuotes();
            if (user.role === 'superadmin') {
                fetchCompanies();
            }
        }
    }, [user]);

    useEffect(() => {
        let items = quotes;
        if (user?.role === 'superadmin' && selectedCompany !== 'all') {
            items = items.filter(q => q.companyId === selectedCompany);
        }
        setFilteredQuotes(items);
    }, [selectedCompany, quotes, user]);

    const fetchCompanies = async () => {
        try {
            const companyList = await getCompanies();
            setCompanies(companyList);
        } catch (err) {
            setError('Error al cargar las compañías.');
            console.error(err);
        }
    };

    const fetchQuotes = async () => {
        try {
            setLoading(true);
            const companyId = user?.role === 'superadmin' ? undefined : user?.companyId;
            const quoteList = await getQuotes(companyId);
            setQuotes(quoteList);
        } catch (err) {
            setError('Error al cargar las cotizaciones.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    if (error) {
        return <p className="text-center text-red-500">{error}</p>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold mb-8">Gestión de Cotizaciones</h1>

            {user?.role === 'superadmin' && (
                <div className="mb-4">
                    <label htmlFor="company-filter" className="block text-sm font-medium text-gray-700">Filtrar por Compañía</label>
                    <select
                        id="company-filter"
                        value={selectedCompany}
                        onChange={e => setSelectedCompany(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                        <option value="all">Todas las compañías</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)} 
                    </select>
                </div>
            )}

            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nombre</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Concepto</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cantidad</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                            {user?.role === 'superadmin' && <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Compañía</th>}
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredQuotes.map(quote => (
                            <tr key={quote.id}>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{quote.name}</td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{quote.email}</td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{quote.concept.name}</td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{quote.quantity}</td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{quote.status}</td>
                                {user?.role === 'superadmin' && <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    {companies.find(c => c.id === quote.companyId)?.name || ''}
                                </td>}
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                                    <Link to={`/admin/quotes/${quote.id}`} className="text-indigo-600 hover:text-indigo-900">Ver Detalles</Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default QuoteListPage;
