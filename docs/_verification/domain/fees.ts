// packages/domain/src/fees.ts — pure, no I/O. The ONLY place money is calculated.

export interface PricingConfig {
  convenienceFeePaise: number; // flat fee charged to the player, e.g. 2000 = ₹20
  gstBps: number;              // 1800 = 18 %
  commissionBps: number;       // 1000 = 10 % of the court price, taken from the venue
}

export interface FeeBreakdown {
  basePaise: number;                // court price set by the venue (what the venue quoted the player)
  convenienceFeePaise: number;
  gstOnConvenienceFeePaise: number;
  discountPaise: number;
  totalPaise: number;               // what the player pays
  commissionPaise: number;          // platform commission, withheld from the venue
  gstOnCommissionPaise: number;     // GST the platform charges the venue on that commission
  venuePayoutPaise: number;         // what the venue receives via Route
}

/** Round-half-up percentage in basis points, integer arithmetic only. */
export function applyBps(amountPaise: number, bps: number): number {
  if (!Number.isInteger(amountPaise) || amountPaise < 0) throw new RangeError('amountPaise must be a non-negative integer');
  return Math.floor((amountPaise * bps + 5000) / 10000);
}

export function calculateFees(basePaise: number, cfg: PricingConfig, discountPaise = 0): FeeBreakdown {
  if (!Number.isInteger(basePaise) || basePaise <= 0) throw new RangeError('basePaise must be a positive integer');
  if (!Number.isInteger(discountPaise) || discountPaise < 0 || discountPaise > basePaise) throw new RangeError('invalid discount');

  const convenienceFeePaise = cfg.convenienceFeePaise;
  const gstOnConvenienceFeePaise = applyBps(convenienceFeePaise, cfg.gstBps);
  const totalPaise = basePaise + convenienceFeePaise + gstOnConvenienceFeePaise - discountPaise;

  const commissionPaise = applyBps(basePaise, cfg.commissionBps);
  const gstOnCommissionPaise = applyBps(commissionPaise, cfg.gstBps);
  const venuePayoutPaise = basePaise - commissionPaise - gstOnCommissionPaise;

  return {
    basePaise, convenienceFeePaise, gstOnConvenienceFeePaise, discountPaise, totalPaise,
    commissionPaise, gstOnCommissionPaise, venuePayoutPaise,
  };
}

/** Phase-1 defaults. These are HYPOTHESES to validate (product plan §4.8), stored in PlatformConfig, never hard-coded at call sites. */
export const DEFAULT_PRICING: PricingConfig = { convenienceFeePaise: 2000, gstBps: 1800, commissionBps: 1000 };

export const formatINR = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: paise % 100 === 0 ? 0 : 2 }).format(paise / 100);
