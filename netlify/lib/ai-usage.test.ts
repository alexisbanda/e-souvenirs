import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { consumeAiGeneration, getAiGenerationsPerHour, getCompanyAiGenerationsPerHour } from './ai-usage';

const HOUR = 3_600_000;

const fakeDb = () => {
  const docs = new Map<string, Record<string, unknown>>();
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({ path: `${name}/${id}` }),
    }),
    runTransaction: async (callback: (transaction: unknown) => Promise<unknown>) =>
      callback({
        get: async ({ path }: { path: string }) => ({ data: () => docs.get(path) }),
        set: ({ path }: { path: string }, data: Record<string, unknown>) => docs.set(path, data),
      }),
  };
  return { db: db as unknown as Firestore, docs };
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
});
