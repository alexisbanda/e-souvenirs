import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeScript = { src: string; async: boolean; onload: () => void; onerror: () => void; remove: ReturnType<typeof vi.fn> };

describe('loadTurnstileScript', () => {
  let scripts: FakeScript[];
  let fakeWindow: { turnstile?: object };
  let loadTurnstileScript: () => Promise<void>;

  beforeEach(async () => {
    scripts = [];
    fakeWindow = {};
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('document', {
      createElement: () => ({ remove: vi.fn() }),
      head: { appendChild: (script: FakeScript) => scripts.push(script) },
    });
    // Cada test parte de un módulo nuevo: guarda la promesa de la carga en curso.
    vi.resetModules();
    ({ loadTurnstileScript } = await import('./turnstileScript'));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('no añade el script si Turnstile ya está cargado', async () => {
    fakeWindow.turnstile = {};

    await expect(loadTurnstileScript()).resolves.toBeUndefined();
    expect(scripts).toHaveLength(0);
  });

  it('dos llamadas durante la carga comparten un solo script', async () => {
    const first = loadTurnstileScript();
    const second = loadTurnstileScript();

    expect(scripts).toHaveLength(1);
    fakeWindow.turnstile = {};
    scripts[0].onload();
    await expect(Promise.all([first, second])).resolves.toBeDefined();
  });

  it('tras un fallo de carga, reintentar añade otro script y puede funcionar', async () => {
    const failed = loadTurnstileScript();
    scripts[0].onerror();
    await expect(failed).rejects.toThrow('Could not load Turnstile.');
    expect(scripts[0].remove).toHaveBeenCalled();

    const retried = loadTurnstileScript();
    expect(scripts).toHaveLength(2);
    fakeWindow.turnstile = {};
    scripts[1].onload();

    await expect(retried).resolves.toBeUndefined();
  });

  it('un script que carga sin definir Turnstile cuenta como fallo y se puede reintentar', async () => {
    const failed = loadTurnstileScript();
    scripts[0].onload();

    await expect(failed).rejects.toThrow('Could not load Turnstile.');
    loadTurnstileScript();
    expect(scripts).toHaveLength(2);
  });
});
