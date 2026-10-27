// packages/domain/src/refunds.ts — pure. Mirrors the table in docs/05 §2.5.

export interface RefundTierRule {
  minHoursBefore: number; // tier applies when hours-until-start >= this value
  refundBps: number;      // share of the BASE court price refunded (10000 = 100 %)
  code: string;
}

/** Platform default; a venue may override via Venue.cancellationPolicy (must stay within platform bounds). */
export const DEFAULT_REFUND_TIERS: RefundTierRule[] = [
  { minHoursBefore: 24, refundBps: 10000, code: 'GT_24H' },
  { minHoursBefore: 12, refundBps: 5000, code: 'H12_24' },
  { minHoursBefore: 0, refundBps: 0, code: 'LT_12H' },
];

export type CancelledBy = 'USER' | 'VENUE' | 'ADMIN' | 'SYSTEM';

export interface RefundInput {
  cancelledBy: CancelledBy;
  /** Set when the player pays but the slot can no longer be given (late payment after expiry, etc.). */
  slotUnavailable?: boolean;
  startTime: Date;
  now: Date;
  basePaise: number;
  convenienceFeePaise: number;
  gstOnConvenienceFeePaise: number;
  totalPaise: number;
  venuePayoutPaise: number;
  commissionBps: number;
  gstBps: number;
  tiers?: RefundTierRule[];
}

export interface RefundDecision {
  tier: string;
  refundPaise: number;         // amount returned to the player
  venueKeepsPayoutPaise: number; // venue payout that remains after the cancellation
  transferReversalPaise: number; // amount to claw back from the Route transfer
  nonRefundableFeePaise: number; // convenience fee + GST retained by the platform
}

const bps = (amount: number, rate: number) => Math.floor((amount * rate + 5000) / 10000);

export function computeRefund(i: RefundInput): RefundDecision {
  // Anything that is not the player's choice returns everything, including the convenience fee.
  if (i.cancelledBy !== 'USER' || i.slotUnavailable) {
    return {
      tier: i.slotUnavailable ? 'SLOT_UNAVAILABLE' : 'VENUE_CANCELLED',
      refundPaise: i.totalPaise,
      venueKeepsPayoutPaise: 0,
      transferReversalPaise: i.venuePayoutPaise,
      nonRefundableFeePaise: 0,
    };
  }

  const hoursBefore = (i.startTime.getTime() - i.now.getTime()) / 3_600_000;
  const tiers = [...(i.tiers ?? DEFAULT_REFUND_TIERS)].sort((a, b) => b.minHoursBefore - a.minHoursBefore);
  const tier = hoursBefore < 0
    ? { minHoursBefore: -Infinity, refundBps: 0, code: 'AFTER_START' }
    : tiers.find((t) => hoursBefore >= t.minHoursBefore) ?? tiers[tiers.length - 1]!;

  const refundedBase = bps(i.basePaise, tier.refundBps);
  const retainedBase = i.basePaise - refundedBase;
  const commission = bps(retainedBase, i.commissionBps);
  const venueKeeps = retainedBase - commission - bps(commission, i.gstBps);

  return {
    tier: tier.code,
    refundPaise: refundedBase, // convenience fee + its GST are never returned on a player cancellation
    venueKeepsPayoutPaise: venueKeeps,
    transferReversalPaise: i.venuePayoutPaise - venueKeeps,
    nonRefundableFeePaise: i.convenienceFeePaise + i.gstOnConvenienceFeePaise,
  };
}
