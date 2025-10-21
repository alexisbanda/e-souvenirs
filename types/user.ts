// types/user.ts

export type UserRole = 'superadmin' | 'companyadmin' | 'client';

export interface AppUser {
  /** Firebase Auth UID */
  id: string;
  /** Email del usuario */
  email: string;
  /** Rol del usuario */
  role: UserRole;
  /** ID de la compañía asociada (solo para companyadmin y client) */
  companyId?: string;
  /** Nombre del usuario */
  name?: string;
  /** Fecha de creación */
  createdAt?: string;
}

export interface ClientProfile {
  /** Firebase Auth UID */
  id: string;
  /** Email del cliente */
  email: string;
  /** Nombre del cliente */
  name?: string;
  /** Teléfono */
  phone?: string;
  /** Dirección */
  address?: string;
  /** ID de la compañía asociada (si aplica) */
  companyId?: string;
  /** Fecha de registro */
  createdAt?: string;
  /** Otros datos personalizados */
  [key: string]: any;
}
