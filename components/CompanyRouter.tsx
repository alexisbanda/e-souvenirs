import React, { useEffect, useState } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { getCompanyBySlug } from '../services/companyService';
import { Company } from '../types/company';
import { CompanyProvider } from '../context/CompanyContext';
import { CartProvider } from '../context/CartContext';
import { ThemeProvider } from './ThemeProvider';

const CompanyRouter: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompany = async () => {
      if (!companySlug) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const companyData = await getCompanyBySlug(companySlug);
        if (companyData) {
          setCompany(companyData);
        } else {
          setError('Company not found');
        }
      } catch (err) {
        setError('Failed to fetch company data');
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, [companySlug]);

  if (loading) {
    return <div>Loading company...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!company) {
    return <Outlet />;
  }

  return (
    <CompanyProvider company={company}>
      <ThemeProvider company={company}>
        <CartProvider>
          <Outlet />
        </CartProvider>
      </ThemeProvider>
    </CompanyProvider>
  );
};

export default CompanyRouter;
