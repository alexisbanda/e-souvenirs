export type Coupon = {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  companyId: string;
  isActive: boolean;
  validUntil?: Date;
  minPurchase?: number;
};
