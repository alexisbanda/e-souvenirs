import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({ doc: vi.fn(), onSnapshot: vi.fn() }));
vi.mock('../services/firebase', () => ({ auth: {}, db: {} }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import IdeaWizard from './IdeaWizard';

const render = (showLoginNotice: boolean) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <IdeaWizard
        eventTypes={[{ name: 'Boda', icon: '💍' }]}
        onConceptsUpdate={() => {}}
        onSubmitStart={() => {}}
        onSearchStart={() => {}}
        onSearchEnd={() => {}}
        isLoading={false}
        setIsLoading={() => {}}
        companyId="c1"
        companySlug="tienda"
        showLoginNotice={showLoginNotice}
        onBeforeLogin={() => {}}
      />
    </MemoryRouter>,
  );

describe('IdeaWizard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('avisa desde el primer paso de que hace falta sesión, con enlace a la tienda', () => {
    const html = render(true);

    expect(html).toContain('ideaWizard.step1.title');
    expect(html).toContain('ideaWizard.errors.login');
    expect(html).toContain('href="/tienda/login"');
  });

  it('con sesión no muestra el aviso', () => {
    const html = render(false);

    expect(html).not.toContain('ideaWizard.errors.login');
    expect(html).not.toContain('href="/tienda/login"');
  });

  it('al volver retoma el paso, las selecciones y los detalles guardados', () => {
    const draft = { step: 3, selections: { event: 'Boda', style: 'modern' }, details: 'con iniciales' };
    vi.stubGlobal('sessionStorage', { getItem: () => JSON.stringify(draft), setItem: vi.fn(), removeItem: vi.fn() });

    const html = render(false);

    expect(html).toContain('ideaWizard.step3.title');
    expect(html).toContain('con iniciales');
    expect(html).toContain('ideaWizard.styles.modern');
  });
});
