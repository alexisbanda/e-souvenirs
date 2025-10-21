import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';

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

    return (
        <header className="shadow-md sticky top-0 z-50" style={{ background: 'var(--brand-secondary)' }}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex-shrink-0 flex items-center gap-3">
                        <Link to={baseUrl || '/'} className="flex items-center gap-2">
                            {company?.logo && (
                                <img src={company.logo} alt={company.name} className="h-10 w-10 rounded-full object-cover" />
                            )}
                            <span className="text-2xl font-serif font-bold" style={{ color: 'var(--brand-primary)' }}>
                                {company?.name || 'Recuerdos Artesanales'}
                            </span>
                        </Link>
                    </div>
                    <nav className="hidden md:flex md:items-center md:space-x-4">
                        <NavLink to={`${baseUrl}/`} className={navLinkClass}>Inicio</NavLink>
                        <NavLink to={`${baseUrl}/catalogo`} className={navLinkClass}>Catálogo</NavLink>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Link to={`${baseUrl}/carrito`} className="relative p-2 rounded-full text-[var(--brand-text)] hover:bg-[var(--brand-accent)] hover:text-white transition-colors duration-300">
                            <span className="sr-only">Ver carrito</span>
                            <ShoppingCartIcon />
                            {itemCount > 0 && (
                                <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center transform translate-x-1/2 -translate-y-1/2">
                                    {itemCount}
                                </span>
                            )}
                        </Link>

                        <div className="relative">
                            {user ? (
                                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="p-2 rounded-full text-[var(--brand-text)] hover:bg-[var(--brand-accent)] hover:text-white transition-colors duration-300">
                                    <UserIcon />
                                </button>
                            ) : (
                                <Link to={`${baseUrl}/login`} className="py-2 px-3 rounded-md text-sm font-medium transition-colors duration-300 bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-accent)]">
                                    Login
                                </Link>
                            )}
                            {isUserMenuOpen && user && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                                    <Link to={`${baseUrl}/perfil`} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setIsUserMenuOpen(false)}>Mi Perfil</Link>
                                    <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Cerrar Sesión</button>
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
                <div className="md:hidden px-2 pt-2 pb-3 space-y-1 sm:px-3">
                     <NavLink to={`${baseUrl}/`} className={navLinkClass} onClick={() => setIsMenuOpen(false)}>Inicio</NavLink>
                     <NavLink to={`${baseUrl}/catalogo`} className={navLinkClass} onClick={() => setIsMenuOpen(false)}>Catálogo</NavLink>
                     {user && <NavLink to={`${baseUrl}/perfil`} className={navLinkClass} onClick={() => setIsMenuOpen(false)}>Mi Perfil</NavLink>}
                </div>
            )}
        </header>
    );
};

export default Header;