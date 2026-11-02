import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createEnv, seed } from './helpers';

let env: RulesTestEnvironment;

const FOLDERS = ['products', 'company-logos', 'category-images'];
const MAX_SIZE = 2 * 1024 * 1024;
const png = { contentType: 'image/png' };
const bytes = (size = 16) => new Uint8Array(size);

const storageAs = (uid?: string) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).storage();

const upload = async (uid: string | undefined, path: string, data = bytes(), metadata: { contentType: string } = png) => {
  await storageAs(uid).ref(path).put(data, metadata);
};

beforeAll(async () => {
  env = await createEnv();
});
beforeEach(async () => {
  await seed(env);
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (context) => {
    await context.storage().ref('products/existente.png').put(bytes(), png);
    await context.storage().ref('generated-images/generada.jpeg').put(bytes(), { contentType: 'image/jpeg' });
  });
});
afterAll(async () => {
  await env.cleanup();
});

describe('storage', () => {
  it.each(FOLDERS)('companyadmin y superadmin suben una imagen a %s', async (folder) => {
    await assertSucceeds(upload('adminA', `${folder}/a.png`));
    await assertSucceeds(upload('superadmin', `${folder}/s.png`));
  });

  it.each(FOLDERS)('client, sesión sin documento y anónimo no suben a %s', async (folder) => {
    await assertFails(upload('client', `${folder}/c.png`));
    await assertFails(upload('sinDocumento', `${folder}/d.png`));
    await assertFails(upload('sinRol', `${folder}/r.png`));
    await assertFails(upload(undefined, `${folder}/n.png`));
  });

  it('rechaza un tipo que no es imagen', async () => {
    await assertFails(upload('adminA', 'products/a.pdf', bytes(), { contentType: 'application/pdf' }));
    await assertFails(upload('adminA', 'products/a.html', bytes(), { contentType: 'text/html' }));
  });

  it('rechaza 2 MB o más y admite justo por debajo', async () => {
    await assertFails(upload('adminA', 'products/justo.png', bytes(MAX_SIZE)));
    await assertFails(upload('adminA', 'products/grande.png', bytes(MAX_SIZE + 1)));
    await assertSucceeds(upload('adminA', 'products/limite.png', bytes(MAX_SIZE - 1)));
  });

  it('no sobrescribe ni borra', async () => {
    await assertFails(upload('adminA', 'products/existente.png'));
    await assertFails(upload('superadmin', 'products/existente.png'));
    await assertFails(storageAs('adminA').ref('products/existente.png').delete());
    await assertFails(storageAs('superadmin').ref('products/existente.png').delete());
  });

  it('la lectura de las carpetas es pública', async () => {
    await assertSucceeds(storageAs().ref('products/existente.png').getMetadata());
    await assertSucceeds(storageAs('client').ref('products/existente.png').getDownloadURL());
  });

  it('deniega fuera de las carpetas', async () => {
    await assertFails(upload('superadmin', 'otra/a.png'));
    await assertFails(upload('superadmin', 'a.png'));
    await assertFails(upload('adminA', 'generated-images/a.png'));
    await assertFails(storageAs().ref('generated-images/generada.jpeg').getMetadata());
    await assertFails(storageAs('superadmin').ref('generated-images/generada.jpeg').getMetadata());
  });
});
