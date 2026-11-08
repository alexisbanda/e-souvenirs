import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/firebase', () => ({ auth: {}, db: {}, storage: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('../context/CompanyContext', () => ({ useCompany: () => ({ company: null }) }));
vi.mock('../components/LandingPage', () => ({ default: () => <div>landing-page</div> }));

import HomePage from './HomePage';

describe('HomePage', () => {
  it('sin empresa activa, renderiza la landing', () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('landing-page');
  });
});
