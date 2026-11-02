import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/user';
import Spinner from './Spinner';

interface PrivateRouteProps {
    children: React.ReactElement;
    allowedRoles: UserRole[];
    redirectTo?: string;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, allowedRoles, redirectTo = '/' }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <Spinner />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // AuthContext puede dar un usuario sin rol si users/{uid} no existe o falla su lectura.
    if (!user.role || !allowedRoles.includes(user.role)) {
        return <Navigate to={redirectTo} replace />;
    }

    return children;
};

export default PrivateRoute;
