import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { useTranslation } from 'react-i18next';

const ShoppingCartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const MenuIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const Header: React.FC = () => {
    const { getItemCount } = useCart();
    const { company } = useCompany();
    const { user, logout } = useAuth();
    const { t, i18n } = useTranslation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const itemCount = getItemCount();

    const navLinkClass = ({ isActive }: { isActive: boolean }) =>
        `py-2 px-3 rounded-md text-sm font-medium transition-colors duration-300 ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--brand-text)] hover:bg-[var(--brand-accent)] hover:text-white'}`;

    const baseUrl = company ? `/${company.slug}` : '';

    const handleLogout = async () => {
        await signOut(auth);
        logout();
    };

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        i18n.changeLanguage(e.target.value);
    };

    return (
        <header className="shadow-md sticky top-0 z-50" style={{ background: 'var(--brand-secondary)' }}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 overflow-hidden">
                        <Link to={baseUrl || '/'} className="flex items-center gap-2 overflow-hidden">
                            {company?.logo && (
                                <img src={company.logo} alt={company.name} className="h-10 w-10 md:h-16 md:w-16 rounded-full object-cover flex-shrink-0" />
                            )}
                            <span className="text-lg md:text-2xl font-serif font-bold truncate max-w-[150px] sm:max-w-[200px] md:max-w-none" style={{ color: 'var(--brand-primary)' }}>
                                {company?.name || 'E-souvenirs'}
                            </span>
                        </Link>
                    </div>
                    <nav className="hidden md:flex md:items-center md:space-x-4">
                        <NavLink to={`${baseUrl}/`} className={navLinkClass}>{t('header.home')}</NavLink>
                        <NavLink to={`${baseUrl}/catalogo`} className={navLinkClass}>{t('header.catalog')}</NavLink>
                    </nav>
                    <div className="flex items-center gap-4">
                        <div className="relative hidden md:block">
                            <div className="flex bg-black/5 border border-gray-600/30 rounded-lg p-1">
                                <button 
                                    onClick={() => i18n.changeLanguage('es')}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${i18n.language === 'es' ? 'bg-[var(--brand-primary)] text-white shadow' : 'text-[var(--brand-text)] opacity-70 hover:opacity-100'}`}
                                >
                                    ES
                                </button>
                                <button 
                                    onClick={() => i18n.changeLanguage('en')}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${i18n.language === 'en' ? 'bg-[var(--brand-primary)] text-white shadow' : 'text-[var(--brand-text)] opacity-70 hover:opacity-100'}`}
                                >
                                    EN
                                </button>
                            </div>
                        </div>
                        <Link to={`${baseUrl}/carrito`} className="relative p-2 rounded-full text-[var(--brand-text)] hover:bg-[var(--brand-accent)] hover:text-white transition-colors duration-300">
                            <span className="sr-only">{t('header.view_cart')}</span>
                            <ShoppingCartIcon />
                            {itemCount > 0 && (
                                <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center transform translate-x-1/2 -translate-y-1/2">
                                    {itemCount}
                                </span>
                            )}
                        </Link>

                        <div className="relative hidden md:block">
                            {user ? (
                                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="p-2 rounded-full text-[var(--brand-text)] hover:bg-[var(--brand-accent)] hover:text-white transition-colors duration-300">
                                    <UserIcon />
                                </button>
                            ) : (
                                <Link to={`${baseUrl}/login`} className="py-2 px-3 rounded-md text-sm font-medium transition-colors duration-300 bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-accent)]">
                                    {t('header.login')}
                                </Link>
                            )}
                            {isUserMenuOpen && user && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                                    <Link to={`${baseUrl}/perfil`} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setIsUserMenuOpen(false)}>{t('header.my_profile')}</Link>
                                    <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{t('header.logout')}</button>
                                </div>
                            )}
                        </div>

                        <div className="md:hidden ml-2">
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-md text-[var(--brand-text)] hover:bg-[var(--brand-accent)] hover:text-white transition-colors duration-300">
                                {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            {isMenuOpen && (
                <div className="md:hidden bg-[var(--brand-secondary)] border-t border-gray-100/10">
                    <div className="px-4 py-4 space-y-3">
                        {/* Main Navigation */}
                        <div className="space-y-1">
                            <NavLink to={`${baseUrl}/`} className="block px-3 py-2 rounded-lg text-base font-medium text-[var(--brand-text)] hover:bg-[var(--brand-primary)] hover:text-white transition-all duration-200" onClick={() => setIsMenuOpen(false)}>
                                {t('header.home')}
                            </NavLink>
                            <NavLink to={`${baseUrl}/catalogo`} className="block px-3 py-2 rounded-lg text-base font-medium text-[var(--brand-text)] hover:bg-[var(--brand-primary)] hover:text-white transition-all duration-200" onClick={() => setIsMenuOpen(false)}>
                                {t('header.catalog')}
                            </NavLink>
                        </div>

                        {/* Secondary Actions Section */}
                        <div className="pt-4 mt-2 border-t border-gray-200/20">
                            {/* Language Selector */}
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-black/5 transition-colors">
                                <div className="flex items-center gap-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--brand-text)] opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.204 8.842l-2.244-2.715m2-2.418a8 8 0 11-16 0 7.962 7.962 0 011.587 2.083M11 9H4" />
                                    </svg>
                                    <span className="text-sm font-medium text-[var(--brand-text)]">{t('header.language')}</span>
                                </div>
                                <div className="flex bg-black/10 rounded-lg p-1">
                                    <button 
                                        onClick={() => i18n.changeLanguage('es')}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${i18n.language === 'es' ? 'bg-white shadow text-gray-900' : 'text-[var(--brand-text)] opacity-60'}`}
                                    >
                                        ES
                                    </button>
                                    <button 
                                        onClick={() => i18n.changeLanguage('en')}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${i18n.language === 'en' ? 'bg-white shadow text-gray-900' : 'text-[var(--brand-text)] opacity-60'}`}
                                    >
                                        EN
                                    </button>
                                </div>
                            </div>

                            {/* User Actions */}
                            {user ? (
                                <div className="mt-2 space-y-1">
                                    <NavLink to={`${baseUrl}/perfil`} className="flex items-center gap-3 px-3 py-2 rounded-lg text-base font-medium text-[var(--brand-text)] hover:bg-[var(--brand-primary)] hover:text-white transition-all duration-200" onClick={() => setIsMenuOpen(false)}>
                                        <UserIcon />
                                        {t('header.my_profile')}
                                    </NavLink>
                                    <button 
                                        onClick={() => { handleLogout(); setIsMenuOpen(false); }} 
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-base font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 text-left"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        {t('header.logout')}
                                    </button>
                                </div>
                            ) : (
                                <div className="mt-4 px-3">
                                    <Link to={`${baseUrl}/login`} className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-bold bg-[var(--brand-primary)] text-white shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/40 transform hover:-translate-y-0.5 transition-all duration-200" onClick={() => setIsMenuOpen(false)}>
                                        <UserIcon />
                                        {t('header.login')}
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;