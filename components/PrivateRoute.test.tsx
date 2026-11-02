import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '../types/user';
import PrivateRoute from './PrivateRoute';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock('../context/AuthContext', () => ({ useAuth: useAuthMock }));

vi.mock('react-router-dom', () => ({
    Navigate: ({ to, replace }: { to: string; replace?: boolean }) => (
        <div data-navigate={to} data-replace={String(Boolean(replace))} />
    ),
}));

const CONTENT = 'contenido-protegido';
const navigateTo = (to: string) => `<div data-navigate="${to}" data-replace="true"></div>`;

const renderRoute = (allowedRoles: UserRole[], redirectTo?: string) =>
    renderToStaticMarkup(
        <PrivateRoute allowedRoles={allowedRoles} redirectTo={redirectTo}>
            <p>{CONTENT}</p>
        </PrivateRoute>,
    );

const signIn = (role?: UserRole) =>
    useAuthMock.mockReturnValue({ user: { id: 'u1', email: 'a@b.c', role }, loading: false });

const signOut = () => useAuthMock.mockReturnValue({ user: null, loading: false });

describe('PrivateRoute', () => {
    beforeEach(() => useAuthMock.mockReset());

    describe("con allowedRoles=['superadmin','companyadmin']", () => {
        const roles: UserRole[] = ['superadmin', 'companyadmin'];

        it.each<UserRole>(['superadmin', 'companyadmin'])('deja pasar a %s', (role) => {
            signIn(role);
            expect(renderRoute(roles)).toContain(CONTENT);
        });

        it('redirige a client a /', () => {
            signIn('client');
            expect(renderRoute(roles)).toBe(navigateTo('/'));
        });

        it('redirige a / a un usuario sin rol', () => {
            signIn(undefined);
            expect(renderRoute(roles)).toBe(navigateTo('/'));
        });

        it('redirige a /login sin usuario', () => {
            signOut();
            expect(renderRoute(roles)).toBe(navigateTo('/login'));
        });

        it('mientras carga no muestra children ni redirige', () => {
            useAuthMock.mockReturnValue({ user: null, loading: true });
            const html = renderRoute(roles);
            expect(html).not.toContain(CONTENT);
            expect(html).not.toContain('data-navigate');
        });

        it('mientras carga no muestra children aunque ya haya usuario', () => {
            useAuthMock.mockReturnValue({
                user: { id: 'u1', email: 'a@b.c', role: 'superadmin' },
                loading: true,
            });
            const html = renderRoute(roles);
            expect(html).not.toContain(CONTENT);
            expect(html).not.toContain('data-navigate');
        });
    });

    describe("con allowedRoles=['superadmin'] y redirectTo='/admin/products'", () => {
        const roles: UserRole[] = ['superadmin'];
        const redirectTo = '/admin/products';

        it('deja pasar a superadmin', () => {
            signIn('superadmin');
            expect(renderRoute(roles, redirectTo)).toContain(CONTENT);
        });

        it('redirige a companyadmin a redirectTo', () => {
            signIn('companyadmin');
            expect(renderRoute(roles, redirectTo)).toBe(navigateTo(redirectTo));
        });

        it('sin usuario redirige a /login, no a redirectTo', () => {
            signOut();
            expect(renderRoute(roles, redirectTo)).toBe(navigateTo('/login'));
        });
    });
});
