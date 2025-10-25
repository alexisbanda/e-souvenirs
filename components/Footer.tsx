
import React from 'react';
import { Link } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import { useTranslation } from 'react-i18next';

const Footer: React.FC = () => {
  const { company } = useCompany();
  const { t } = useTranslation();
  const baseUrl = company ? `/${company.slug}` : '';
  return (
  <footer className="py-8 mt-12" style={{ background: 'var(--brand-secondary)', color: 'var(--brand-text)' }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
          <div className="flex-shrink-0 mb-4 md:mb-0 flex items-center gap-3">
            <Link to={baseUrl || '/'} className="flex items-center gap-2">
              {company?.logo && (
                <img src={company.logo} alt={company.name} className="h-10 w-10 rounded-full object-cover" />
              )}
              <span className="text-2xl font-serif font-bold" style={{ color: 'var(--brand-primary)' }}>
                {company?.name || 'E-souvenirs'}
              </span>
            </Link>
            <p className="mt-2 text-sm text-brand-text">&copy; {new Date().getFullYear()} {company?.name || 'E-souvenirs'}. {t('footer.rights_reserved')}.</p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold">{t('footer.contact')}</span>
            {company?.contactName && <span>{company.contactName}{company?.contactRole ? ` (${company.contactRole})` : ''}</span>}
            {company?.email && <span>{t('footer.email')} {company.email}</span>}
            {company?.phone && <span>{t('footer.phone')} {company.phone}</span>}
            {company?.address && <span>{t('footer.address')} {company.address}</span>}
            {company?.hours && <span>{t('footer.hours')} {company.hours}</span>}
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold">{t('footer.social_media')}</span>
            <div className="flex gap-3 mt-1">
              {company?.settings?.facebook && (
                <a href={company.settings.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  <span className="sr-only">{t('footer.facebook')}</span>
                  <i className="fab fa-facebook-f"></i>
                </a>
              )}
              {company?.settings?.instagram && (
                <a href={company.settings.instagram} target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:underline">
                  <span className="sr-only">{t('footer.instagram')}</span>
                  <i className="fab fa-instagram"></i>
                </a>
              )}
              {company?.settings?.whatsapp && (
                <a href={company.settings.whatsapp} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline">
                  <span className="sr-only">{t('footer.whatsapp')}</span>
                  <i className="fab fa-whatsapp"></i>
                </a>
              )}
              {company?.settings?.website && (
                <a href={company.settings.website} target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:underline">
                  <span className="sr-only">{t('footer.website')}</span>
                  <i className="fas fa-globe"></i>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="text-center mt-8">
        <p className="text-sm">
          {t('footer.created_with_love')}{' '}
          <Link to="/" className="font-semibold hover:underline" style={{ color: 'var(--brand-primary)' }}>
            e-souvenirs
          </Link>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
