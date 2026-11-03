import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDocsMock } = vi.hoisted(() => ({ getDocsMock: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  getDocs: getDocsMock,
  limit: (count: number) => ({ limit: count }),
  query: (source: string, ...constraints: unknown[]) => ({ source, constraints }),
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
}));
vi.mock('./firebase', () => ({ db: {} }));

import { getRelatedProducts } from './productService';

interface FakeProduct {
  id: string;
  companyId: string;
  category: string;
}

interface FakeConstraint {
  field?: string;
  op?: string;
  value?: unknown;
  limit?: number;
}

const taza = (id: string, companyId: string): FakeProduct => ({ id, companyId, category: 'Tazas' });

// Fake de getDocs: aplica los where y el limit recibidos, como haría Firestore.
const serveProducts = (products: FakeProduct[]) => {
  getDocsMock.mockImplementation(async ({ constraints }: { constraints: FakeConstraint[] }) => {
    let results = products;
    for (const { field, op, value } of constraints) {
      if (field === undefined) continue;
      if (op !== '==') throw new Error(`Operador no soportado por el fake: ${op}`);
      results = results.filter((product) => product[field as keyof FakeProduct] === value);
    }
    const count = constraints.find((constraint) => constraint.limit !== undefined)?.limit;
    return {
      docs: results.slice(0, count).map(({ id, ...data }) => ({ id, data: () => data })),
    };
  });
};

const ids = (products: { id: string }[]) => products.map((product) => product.id);

describe('getRelatedProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('solo devuelve productos de la empresa indicada, aunque otra tenga la misma categoría', async () => {
    serveProducts([
      taza('b1', 'empresa-b'),
      taza('b2', 'empresa-b'),
      taza('a1', 'empresa-a'),
      taza('a2', 'empresa-a'),
      { id: 'a3', companyId: 'empresa-a', category: 'Llaveros' },
    ]);

    const related = await getRelatedProducts('a1', 'empresa-a', 'Tazas');

    expect(ids(related)).toEqual(['a2']);
    expect(related[0].companyId).toBe('empresa-a');
  });

  it('excluye el propio producto y aun así completa 4 relacionados', async () => {
    serveProducts(['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => taza(id, 'empresa-a')));

    const related = await getRelatedProducts('a1', 'empresa-a', 'Tazas');

    expect(ids(related)).toEqual(['a2', 'a3', 'a4', 'a5']);
  });

  it('devuelve 4 como máximo con 5 resultados que no incluyen el propio producto', async () => {
    serveProducts(['a2', 'a3', 'a4', 'a5', 'a6'].map((id) => taza(id, 'empresa-a')));

    const related = await getRelatedProducts('a1', 'empresa-a', 'Tazas');

    expect(ids(related)).toEqual(['a2', 'a3', 'a4', 'a5']);
  });

  it('consulta por companyId y category con limit(5), sin __name__ ni orderBy', async () => {
    serveProducts([]);

    await getRelatedProducts('a1', 'empresa-a', 'Tazas');

    expect(getDocsMock).toHaveBeenCalledTimes(1);
    // La igualdad exacta deja fuera cualquier otra restricción, como __name__ u orderBy.
    expect(getDocsMock).toHaveBeenCalledWith({
      source: 'products',
      constraints: [
        { field: 'companyId', op: '==', value: 'empresa-a' },
        { field: 'category', op: '==', value: 'Tazas' },
        { limit: 5 },
      ],
    });
  });
});
