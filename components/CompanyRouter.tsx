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
  
  // Logic to apply default language if user hasn't selected one
  // Check if there is a language cookie
  const hasLanguageCookie = document.cookie.split(';').some((item) => item.trim().startsWith('i18next='));
  
  if (!hasLanguageCookie && company.settings.defaultLanguage) {
      // Use i18n to change language?
      // Since this is a router component, we might want to do this effect once when company loads
  }

  return (
    <CompanyProvider company={company}>
      <ThemeProvider company={company}>
        <CartProvider>
          <LanguageEnforcer defaultLanguage={company.settings.defaultLanguage}>
            <Outlet />
          </LanguageEnforcer>
        </CartProvider>
      </ThemeProvider>
    </CompanyProvider>
  );
};

// Helper component to enforce language
import { useTranslation } from 'react-i18next';

const LanguageEnforcer: React.FC<{ defaultLanguage?: string; children: React.ReactNode }> = ({ defaultLanguage, children }) => {
    const { i18n } = useTranslation();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const hasLanguageCookie = document.cookie.split(';').some((item) => item.trim().startsWith('i18next='));
        if (!hasLanguageCookie && defaultLanguage && i18n.language !== defaultLanguage) {
            i18n.changeLanguage(defaultLanguage);
        }
        setChecked(true);
    }, [defaultLanguage, i18n]);

    if (!checked) return null; // Or render children immediately if we don't want to block

    return <>{children}</>;
};

export default CompanyRouter;
