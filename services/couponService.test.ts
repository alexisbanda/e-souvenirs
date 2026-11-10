import { beforeEach, describe, expect, it, vi } from 'vitest';

const DELETE_FIELD_SENTINEL = { __deleteField__: true };

const { addDocMock, updateDocMock, getDocsMock } = vi.hoisted(() => ({
  addDocMock: vi.fn(),
  updateDocMock: vi.fn(),
  getDocsMock: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  doc: (_db: unknown, name: string, id: string) => ({ name, id }),
  addDoc: addDocMock,
  updateDoc: updateDocMock,
  deleteDoc: vi.fn(),
  getDocs: getDocsMock,
  getDoc: vi.fn(),
  limit: (count: number) => ({ limit: count }),
  query: (source: string, ...constraints: unknown[]) => ({ source, constraints }),
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
  deleteField: () => DELETE_FIELD_SENTINEL,
  Timestamp: {},
}));
vi.mock('./firebase', () => ({ db: {} }));

import { createCoupon, updateCoupon, isCouponCodeTaken } from './couponService';
import { Coupon } from '../types/coupon';

describe('createCoupon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addDocMock.mockResolvedValue({ id: 'new-id' });
  });

  it('no envía validUntil ni ningún valor undefined cuando se crea sin fecha de vigencia', async () => {
    await createCoupon({
      code: 'verano',
      discountType: 'percentage',
      discountValue: 10,
      isActive: true,
      companyId: 'empresa-a',
      validUntil: undefined,
      minPurchase: 0,
    } as unknown as Omit<Coupon, 'id'>);

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const payload = addDocMock.mock.calls[0][1];
    expect(payload).not.toHaveProperty('validUntil');
    expect(payload.code).toBe('VERANO');
    expect(Object.values(payload).some((value) => value === undefined)).toBe(false);
  });
});

describe('updateCoupon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('borra la caducidad con deleteField() cuando se vacía validUntil al editar', async () => {
    await updateCoupon('coupon-1', {
      code: 'verano',
      validUntil: undefined,
    } as unknown as Partial<Omit<Coupon, 'id'>>);

    expect(updateDocMock).toHaveBeenCalledTimes(1);
    const payload = updateDocMock.mock.calls[0][1];
    expect(payload.validUntil).toBe(DELETE_FIELD_SENTINEL);
    expect(Object.values(payload).some((value) => value === undefined)).toBe(false);
  });

  it('también borra la caducidad con deleteField() cuando validUntil llega como null', async () => {
    await updateCoupon('coupon-1', {
      validUntil: null,
    } as unknown as Partial<Omit<Coupon, 'id'>>);

    const payload = updateDocMock.mock.calls[0][1];
    expect(payload.validUntil).toBe(DELETE_FIELD_SENTINEL);
  });
});

describe('isCouponCodeTaken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve false cuando no hay ningún cupón con ese código en la tienda', async () => {
    getDocsMock.mockResolvedValue({ empty: true, docs: [] });

    const taken = await isCouponCodeTaken('empresa-a', 'verano');

    expect(taken).toBe(false);
    expect(getDocsMock).toHaveBeenCalledWith({
      source: 'coupons',
      constraints: [
        { field: 'companyId', op: '==', value: 'empresa-a' },
        { field: 'code', op: '==', value: 'VERANO' },
        { limit: 1 },
      ],
    });
  });

  it('devuelve true cuando existe un doc con ese código que no es el que se está editando', async () => {
    getDocsMock.mockResolvedValue({ empty: false, docs: [{ id: 'other-id' }] });

    const taken = await isCouponCodeTaken('empresa-a', 'verano', 'coupon-1');

    expect(taken).toBe(true);
  });

  it('devuelve false cuando el único doc encontrado es el propio cupón que se edita (excludeId)', async () => {
    getDocsMock.mockResolvedValue({ empty: false, docs: [{ id: 'coupon-1' }] });

    const taken = await isCouponCodeTaken('empresa-a', 'verano', 'coupon-1');

    expect(taken).toBe(false);
  });
});
