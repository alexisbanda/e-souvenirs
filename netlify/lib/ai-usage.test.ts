import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import {
  consumeAiGeneration,
  getAiGenerationsPerHour,
  getCompanyAiGenerationsPerHour,
  getGlobalAiGenerationsPerHour,
  releaseAiGeneration,
} from './ai-usage';

const HOUR = 3_600_000;

// Como Firestore, exige leer antes de escribir y aplica las escrituras al final de la transacción.
const fakeDb = () => {
  const docs = new Map<string, Record<string, unknown>>();
  let transactions = 0;
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({ path: `${name}/${id}` }),
    }),
    runTransaction: async (callback: (transaction: unknown) => Promise<unknown>) => {
      transactions++;
      const writes: [string, Record<string, unknown>][] = [];
      const result = await callback({
        get: async ({ path }: { path: string }) => {
          if (writes.length > 0) throw new Error('Firestore exige leer antes de escribir.');
          return { data: () => docs.get(path) };
        },
        set: ({ path }: { path: string }, data: Record<string, unknown>) => writes.push([path, data]),
      });
      writes.forEach(([path, data]) => docs.set(path, data));
      return result;
    },
  };
  return { db: db as unknown as Firestore, docs, transactionCount: () => transactions };
};

describe('getAiGenerationsPerHour', () => {
  it.each([[undefined, 10], ['', 10], ['abc', 10], ['0', 10], ['-3', 10], ['1.5', 10], ['5x', 10], ['1e3', 10], ['3', 3], [' 25 ', 25]])(
    '%j usa %i',
    (raw, expected) => {
      const previous = process.env.AI_GENERATIONS_PER_HOUR;
      delete process.env.AI_GENERATIONS_PER_HOUR;
      expect(getAiGenerationsPerHour(raw)).toBe(expected);
      if (previous !== undefined) process.env.AI_GENERATIONS_PER_HOUR = previous;
    },
  );
});

describe('getCompanyAiGenerationsPerHour', () => {
  it.each([[undefined, 100], ['0', 100], ['abc', 100], ['250', 250]])('%j usa %i', (raw, expected) => {
    const previous = process.env.AI_COMPANY_GENERATIONS_PER_HOUR;
    delete process.env.AI_COMPANY_GENERATIONS_PER_HOUR;
    expect(getCompanyAiGenerationsPerHour(raw)).toBe(expected);
    if (previous !== undefined) process.env.AI_COMPANY_GENERATIONS_PER_HOUR = previous;
  });
});

describe('getGlobalAiGenerationsPerHour', () => {
  const withoutVariable = (run: () => void) => {
    const previous = process.env.AI_GLOBAL_GENERATIONS_PER_HOUR;
    delete process.env.AI_GLOBAL_GENERATIONS_PER_HOUR;
    try {
      run();
    } finally {
      if (previous !== undefined) process.env.AI_GLOBAL_GENERATIONS_PER_HOUR = previous;
    }
  };

  it.each([
    [undefined, 500],
    ['', 500],
    ['0', 500],
    ['-3', 500],
    ['1.5', 500],
    ['abc', 500],
    ['5x', 500],
    ['1e3', 500],
    ['99999999999999999999', 500],
    ['2', 2],
    [' 750 ', 750],
  ])('%j usa %i', (raw, expected) => {
    withoutVariable(() => expect(getGlobalAiGenerationsPerHour(raw)).toBe(expected));
  });

  it('lee AI_GLOBAL_GENERATIONS_PER_HOUR', () => {
    withoutVariable(() => {
      process.env.AI_GLOBAL_GENERATIONS_PER_HOUR = '7';
      expect(getGlobalAiGenerationsPerHour()).toBe(7);
      delete process.env.AI_GLOBAL_GENERATIONS_PER_HOUR;
    });
  });
});

describe('consumeAiGeneration', () => {
  const now = 500 * HOUR + 15 * 60_000;

  it('deja pasar N peticiones y rechaza la N+1 con el tiempo que falta para la siguiente ventana', async () => {
    const { db } = fakeDb();

    for (let i = 0; i < 3; i++) {
      await expect(consumeAiGeneration(db, 'u1', 'c1', { limit: 3, now })).resolves.toEqual({ allowed: true });
    }

    await expect(consumeAiGeneration(db, 'u1', 'c1', { limit: 3, now })).resolves.toEqual({ allowed: false, scope: 'user', retryAfterSeconds: 45 * 60 });
  });

  it('guarda el contador en aiUsage/{uid}_{ventana}, con expiresAt posterior al fin de la ventana', async () => {
    const { db, docs } = fakeDb();

    await consumeAiGeneration(db, 'u1', 'c1', { limit: 3, now });

    const usage = docs.get('aiUsage/u1_500') as { count: number; uid: string; expiresAt: Date };
    expect(usage.count).toBe(1);
    expect(usage.uid).toBe('u1');
    expect(usage.expiresAt.getTime()).toBeGreaterThan(501 * HOUR);
  });

  it('no escribe nada cuando rechaza', async () => {
    const { db, docs } = fakeDb();
    await consumeAiGeneration(db, 'u1', 'c1', { limit: 1, now });

    await consumeAiGeneration(db, 'u1', 'c1', { limit: 1, now });

    expect((docs.get('aiUsage/u1_500') as { count: number }).count).toBe(1);
  });

  it('cuenta por separado cada usuario y cada ventana', async () => {
    const { db } = fakeDb();
    await consumeAiGeneration(db, 'u1', 'c1', { limit: 1, now });

    await expect(consumeAiGeneration(db, 'u2', 'c1', { limit: 1, now })).resolves.toEqual({ allowed: true });
    await expect(consumeAiGeneration(db, 'u1', 'c1', { limit: 1, now: now + HOUR })).resolves.toEqual({ allowed: true });
  });

  describe('tope por empresa', () => {
    it('muchas cuentas distintas no pasan del tope de la empresa', async () => {
      const { db } = fakeDb();

      await expect(consumeAiGeneration(db, 'u1', 'c1', { limit: 10, companyLimit: 2, now })).resolves.toEqual({ allowed: true });
      await expect(consumeAiGeneration(db, 'u2', 'c1', { limit: 10, companyLimit: 2, now })).resolves.toEqual({ allowed: true });

      await expect(consumeAiGeneration(db, 'u3', 'c1', { limit: 10, companyLimit: 2, now })).resolves.toEqual({
        allowed: false,
        scope: 'company',
        retryAfterSeconds: 45 * 60,
      });
    });

    it('guarda el contador en aiUsage/company_{empresa}_{ventana}, con expiresAt', async () => {
      const { db, docs } = fakeDb();

      await consumeAiGeneration(db, 'u1', 'c1', { now });

      const usage = docs.get('aiUsage/company_c1_500') as { count: number; companyId: string; expiresAt: Date };
      expect(usage.count).toBe(1);
      expect(usage.companyId).toBe('c1');
      expect(usage.expiresAt.getTime()).toBeGreaterThan(501 * HOUR);
    });

    it('un rechazo por el tope de empresa no gasta el cupo del usuario', async () => {
      const { db, docs } = fakeDb();
      await consumeAiGeneration(db, 'u1', 'c1', { companyLimit: 1, now });

      await consumeAiGeneration(db, 'u2', 'c1', { companyLimit: 1, now });

      expect(docs.has('aiUsage/u2_500')).toBe(false);
      expect((docs.get('aiUsage/company_c1_500') as { count: number }).count).toBe(1);
    });

    it('un rechazo por el límite del usuario no gasta el cupo de la empresa', async () => {
      const { db, docs } = fakeDb();
      await consumeAiGeneration(db, 'u1', 'c1', { limit: 1, now });

      const result = await consumeAiGeneration(db, 'u1', 'c1', { limit: 1, now });

      expect(result).toMatchObject({ allowed: false, scope: 'user' });
      expect((docs.get('aiUsage/company_c1_500') as { count: number }).count).toBe(1);
    });

    it('cuenta por separado cada empresa y cada ventana', async () => {
      const { db } = fakeDb();
      await consumeAiGeneration(db, 'u1', 'c1', { companyLimit: 1, now });

      await expect(consumeAiGeneration(db, 'u2', 'c2', { companyLimit: 1, now })).resolves.toEqual({ allowed: true });
      await expect(consumeAiGeneration(db, 'u2', 'c1', { companyLimit: 1, now: now + HOUR })).resolves.toEqual({ allowed: true });
    });
  });

  describe('máximo global', () => {
    const counters = (docs: Map<string, Record<string, unknown>>, uid: string, companyId: string) => ({
      user: docs.get(`aiUsage/${uid}_500`)?.count,
      company: docs.get(`aiUsage/company_${companyId}_500`)?.count,
      global: docs.get('aiUsage/global_500')?.count,
    });

    it('muchas cuentas de muchas tiendas no pasan del máximo', async () => {
      const { db } = fakeDb();
      await expect(consumeAiGeneration(db, 'u1', 'c1', { globalLimit: 2, now })).resolves.toEqual({ allowed: true });
      await expect(consumeAiGeneration(db, 'u2', 'c2', { globalLimit: 2, now })).resolves.toEqual({ allowed: true });

      await expect(consumeAiGeneration(db, 'u3', 'c3', { globalLimit: 2, now })).resolves.toEqual({
        allowed: false,
        scope: 'global',
        retryAfterSeconds: 45 * 60,
      });
    });

    it('sin indicar un límite usa 500: la generación 501 se rechaza', async () => {
      const { db, docs } = fakeDb();
      docs.set('aiUsage/global_500', { count: 499 });

      await expect(consumeAiGeneration(db, 'u1', 'c1', { now })).resolves.toEqual({ allowed: true });
      expect(counters(docs, 'u1', 'c1').global).toBe(500);

      await expect(consumeAiGeneration(db, 'u2', 'c2', { now })).resolves.toMatchObject({ allowed: false, scope: 'global' });
      expect(counters(docs, 'u2', 'c2')).toEqual({ user: undefined, company: undefined, global: 500 });
    });

    it('guarda el contador en aiUsage/global_{ventana}, con windowStart y expiresAt', async () => {
      const { db, docs } = fakeDb();

      await consumeAiGeneration(db, 'u1', 'c1', { now });

      expect(docs.get('aiUsage/global_500')).toEqual({
        count: 1,
        windowStart: new Date(500 * HOUR),
        expiresAt: new Date(525 * HOUR),
      });
    });

    it('cuenta los tres contadores en una sola transacción', async () => {
      const { db, docs, transactionCount } = fakeDb();

      await consumeAiGeneration(db, 'u1', 'c1', { now });

      expect(transactionCount()).toBe(1);
      expect(counters(docs, 'u1', 'c1')).toEqual({ user: 1, company: 1, global: 1 });
    });

    it('cuenta por separado cada ventana', async () => {
      const { db, docs } = fakeDb();
      await consumeAiGeneration(db, 'u1', 'c1', { globalLimit: 1, now });

      await expect(consumeAiGeneration(db, 'u2', 'c2', { globalLimit: 1, now: now + HOUR })).resolves.toEqual({ allowed: true });

      expect(docs.get('aiUsage/global_500')?.count).toBe(1);
      expect(docs.get('aiUsage/global_501')?.count).toBe(1);
    });

    it.each([
      ['user', { limit: 2, companyLimit: 50, globalLimit: 50 }],
      ['company', { limit: 50, companyLimit: 2, globalLimit: 50 }],
      ['global', { limit: 50, companyLimit: 50, globalLimit: 2 }],
    ])('un rechazo por el límite %s no incrementa ninguno de los tres contadores', async (scope, limits) => {
      const { db, docs } = fakeDb();
      await consumeAiGeneration(db, 'u1', 'c1', { ...limits, now });
      await consumeAiGeneration(db, 'u1', 'c1', { ...limits, now });

      const result = await consumeAiGeneration(db, 'u1', 'c1', { ...limits, now });

      expect(result).toMatchObject({ allowed: false, scope });
      expect(counters(docs, 'u1', 'c1')).toEqual({ user: 2, company: 2, global: 2 });
    });

    it('un rechazo global no crea contadores para el usuario ni la empresa que lo intentan', async () => {
      const { db, docs } = fakeDb();
      await consumeAiGeneration(db, 'u1', 'c1', { globalLimit: 1, now });

      await consumeAiGeneration(db, 'u2', 'c2', { globalLimit: 1, now });

      expect(counters(docs, 'u2', 'c2')).toEqual({ user: undefined, company: undefined, global: 1 });
      expect(counters(docs, 'u1', 'c1')).toEqual({ user: 1, company: 1, global: 1 });
    });

    it('un rechazo por usuario o por empresa no gasta cupo global', async () => {
      const { db, docs } = fakeDb();
      await consumeAiGeneration(db, 'u1', 'c1', { limit: 1, companyLimit: 2, now });

      await consumeAiGeneration(db, 'u1', 'c1', { limit: 1, companyLimit: 2, now });
      expect(counters(docs, 'u1', 'c1')).toEqual({ user: 1, company: 1, global: 1 });

      await consumeAiGeneration(db, 'u2', 'c1', { limit: 1, companyLimit: 2, now });
      await consumeAiGeneration(db, 'u3', 'c1', { limit: 1, companyLimit: 2, now });
      expect(counters(docs, 'u3', 'c1')).toEqual({ user: undefined, company: 2, global: 2 });
    });

    it.each([
      ['user', { limit: 1, companyLimit: 1, globalLimit: 1 }, 'user'],
      ['company', { limit: 5, companyLimit: 1, globalLimit: 1 }, 'company'],
    ])('si se agotan varios a la vez, comprueba primero %s', async (_name, limits, scope) => {
      const { db } = fakeDb();
      await consumeAiGeneration(db, 'u1', 'c1', { ...limits, now });

      await expect(consumeAiGeneration(db, 'u1', 'c1', { ...limits, now })).resolves.toMatchObject({ allowed: false, scope });
    });
  });

  describe('releaseAiGeneration', () => {
    const count = (docs: Map<string, Record<string, unknown>>, key: string) => docs.get(key)?.count;

    it('devuelve también la unidad global, y conserva el resto de campos', async () => {
      const { db, docs } = fakeDb();
      await consumeAiGeneration(db, 'u1', 'c1', { now });
      await consumeAiGeneration(db, 'u2', 'c2', { now });

      await releaseAiGeneration(db, 'u1', 'c1', { now });

      expect(count(docs, 'aiUsage/global_500')).toBe(1);
      expect(docs.get('aiUsage/global_500')?.expiresAt).toEqual(new Date(525 * HOUR));
    });

    it('libera el cupo global para otra cuenta de otra tienda', async () => {
      const { db } = fakeDb();
      await consumeAiGeneration(db, 'u1', 'c1', { globalLimit: 1, now });

      await releaseAiGeneration(db, 'u1', 'c1', { now });

      await expect(consumeAiGeneration(db, 'u2', 'c2', { globalLimit: 1, now })).resolves.toEqual({ allowed: true });
    });

    it('descuenta el global de la ventana indicada, no de la actual', async () => {
      const { db, docs } = fakeDb();
      await consumeAiGeneration(db, 'u1', 'c1', { now });
      await consumeAiGeneration(db, 'u1', 'c1', { now: now + HOUR });

      await releaseAiGeneration(db, 'u1', 'c1', { now });

      expect(count(docs, 'aiUsage/global_500')).toBe(0);
      expect(count(docs, 'aiUsage/global_501')).toBe(1);
    });

    it('devuelve la generación al usuario y a la empresa, y conserva el resto de campos', async () => {
      const { db, docs } = fakeDb();
      await consumeAiGeneration(db, 'u1', 'c1', { now });

      await releaseAiGeneration(db, 'u1', 'c1', { now });

      expect(count(docs, 'aiUsage/u1_500')).toBe(0);
      expect(count(docs, 'aiUsage/company_c1_500')).toBe(0);
      expect(docs.get('aiUsage/u1_500')?.expiresAt).toBeInstanceOf(Date);
      expect(docs.get('aiUsage/company_c1_500')?.companyId).toBe('c1');
    });

    it('libera el cupo para otra generación', async () => {
      const { db } = fakeDb();
      await consumeAiGeneration(db, 'u1', 'c1', { limit: 1, now });

      await releaseAiGeneration(db, 'u1', 'c1', { now });

      await expect(consumeAiGeneration(db, 'u1', 'c1', { limit: 1, now })).resolves.toEqual({ allowed: true });
    });

    it('descuenta de la ventana indicada, no de la actual', async () => {
      const { db, docs } = fakeDb();
      await consumeAiGeneration(db, 'u1', 'c1', { now });
      await consumeAiGeneration(db, 'u1', 'c1', { now: now + HOUR });

      await releaseAiGeneration(db, 'u1', 'c1', { now });

      expect(count(docs, 'aiUsage/u1_500')).toBe(0);
      expect(count(docs, 'aiUsage/u1_501')).toBe(1);
    });

    it('no baja de cero ni crea contadores que no existían', async () => {
      const { db, docs } = fakeDb();
      await releaseAiGeneration(db, 'u1', 'c1', { now });
      expect(docs.size).toBe(0);

      await consumeAiGeneration(db, 'u1', 'c1', { now });
      await releaseAiGeneration(db, 'u1', 'c1', { now });
      await releaseAiGeneration(db, 'u1', 'c1', { now });

      expect(count(docs, 'aiUsage/u1_500')).toBe(0);
      expect(count(docs, 'aiUsage/global_500')).toBe(0);
    });
  });
});
