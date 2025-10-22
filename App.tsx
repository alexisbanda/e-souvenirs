import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import RegistrationPage from './pages/RegistrationPage';
import GeneralLoginPage from './pages/GeneralLoginPage';
import AdminLayout from './components/AdminLayout';
import ProductListPage from './pages/admin/ProductListPage';
import ProductFormPage from './pages/admin/ProductFormPage';
import OrderListPage from './pages/admin/OrderListPage';
import OrderDetailPage from './pages/admin/OrderDetailPage';
import CategoryListPage from './pages/admin/CategoryListPage';
import ShippingMethodListPage from './pages/admin/ShippingMethodListPage';
import CompanyListPage from './pages/admin/CompanyListPage';
import CompanyFormPage from './pages/admin/CompanyFormPage';
import UserAdminPage from './pages/admin/UserAdminPage';
import CouponListPage from './pages/admin/CouponListPage';
import CouponFormPage from './pages/admin/CouponFormPage';
import PrivateRoute from './components/PrivateRoute';
import ScrollToTop from './components/ScrollToTop';
import CompanyRouter from './components/CompanyRouter';
import { AuthProvider } from './context/AuthContext';
import CompanyRegistrationPage from './pages/CompanyRegistrationPage';
import RegistrationSuccessPage from './pages/RegistrationSuccessPage';

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <Routes>
          {/* Admin Routes */}
          <Route 
            path="/admin"
            element={
              <PrivateRoute>
                <AdminLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="products" replace />} />
            <Route path="products" element={<ProductListPage />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/edit/:id" element={<ProductFormPage />} />
            <Route path="orders" element={<OrderListPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="categories" element={<CategoryListPage />} />
            <Route path="shipping" element={<ShippingMethodListPage />} />
            <Route path="coupons" element={<CouponListPage />} />
            <Route path="coupons/new" element={<CouponFormPage />} />
            <Route path="coupons/edit/:id" element={<CouponFormPage />} />
            <Route path="companies" element={<CompanyListPage />} />
            <Route path="companies/new" element={<CompanyFormPage />} />
            <Route path="companies/edit/:id" element={<CompanyFormPage />} />
            <Route path="users" element={<UserAdminPage />} />
          </Route>

          <Route path="/login" element={<GeneralLoginPage />} />
          <Route path="/register-company" element={<CompanyRegistrationPage />} />
          <Route path="/registration-success" element={<RegistrationSuccessPage />} />

          {/* Company-scoped public routes */}
          <Route path="/:companySlug" element={<CompanyRouter />}>
            <Route element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="catalogo" element={<CatalogPage />} />
              <Route path="producto/:id" element={<ProductDetailPage />} />
              <Route path="carrito" element={<CartPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="perfil" element={<ProfilePage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegistrationPage />} />
            </Route>
          </Route>

          {/* Root: maybe a company selector or redirect */}
          <Route path="/" element={<HomePage />} />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

const MainLayout: React.FC = () => (
  <div
    className="flex flex-col min-h-screen font-sans"
    style={{ color: 'var(--brand-text)' }}
  >
    <Header />
    <main className="flex-grow">
      <Outlet />
    </main>
    <Footer />
  </div>
);

export default App;