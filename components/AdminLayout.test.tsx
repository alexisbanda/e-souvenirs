import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/firebase', () => ({ auth: {}, db: {}, storage: {} }));

import { PendingApprovalNotice, shouldShowPendingNotice } from './AdminLayout';

describe('shouldShowPendingNotice', () => {
    it.each(['APPROVED', 'ACTIVE'] as const)(
        'companyadmin con empresa %s no debe ver el aviso',
        (status) => {
            expect(shouldShowPendingNotice('companyadmin', status)).toBe(false);
        },
    );

    it('companyadmin con empresa PENDING debe ver el aviso', () => {
        expect(shouldShowPendingNotice('companyadmin', 'PENDING')).toBe(true);
    });

    it('mientras la empresa carga (status null) no debe ver el aviso', () => {
        expect(shouldShowPendingNotice('companyadmin', null)).toBe(false);
    });

    it('el superadmin no ve el aviso aunque la empresa esté PENDING', () => {
        expect(shouldShowPendingNotice('superadmin', 'PENDING')).toBe(false);
    });
});

describe('PendingApprovalNotice', () => {
    it('cuando visible=true, muestra el título y advierte que no recibirá pedidos ni generará ideas con IA', () => {
        const html = renderToStaticMarkup(<PendingApprovalNotice visible={true} />);

        expect(html).toContain('role="status"');
        expect(html).toContain('Tu tienda está en revisión');
        expect(html).toContain('no recibirá pedidos');
        expect(html).toContain('ideas con IA');
    });

    it('cuando visible=false, no renderiza nada', () => {
        const html = renderToStaticMarkup(<PendingApprovalNotice visible={false} />);

        expect(html).toBe('');
    });
});
