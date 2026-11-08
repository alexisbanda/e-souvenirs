import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../context/CompanyContext', () => ({ useCompany: () => ({ company: null }) }));
vi.mock('../components/LandingPage', () => ({ default: () => <div>landing-page</div> }));

import HomePage from './HomePage';

describe('HomePage', () => {
  it('sin empresa activa, renderiza la landing', () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('landing-page');
  });
});
