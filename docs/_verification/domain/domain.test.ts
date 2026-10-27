import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFees, applyBps, DEFAULT_PRICING, formatINR } from './fees.ts';
import { computeRefund } from './refunds.ts';
import { reliabilityScore, windowOutcomes } from './reliability.ts';
import { computeDaySlots, istDayStart, isoWeekday, priceInterval, slotPricePaise } from './availability.ts';

test('fees: ₹400 court → ₹423.60 total (matches v1 E2E expectation)', () => {
  const f = calculateFees(40000, DEFAULT_PRICING);
  assert.deepEqual(f, {
    basePaise: 40000, convenienceFeePaise: 2000, gstOnConvenienceFeePaise: 360, discountPaise: 0, totalPaise: 42360,
    commissionPaise: 4000, gstOnCommissionPaise: 720, venuePayoutPaise: 35280,
  });
  assert.equal(formatINR(42360), '₹423.60');
});
test('fees: identities hold for every ₹1 from ₹1 to ₹2000', () => {
  for (let base = 100; base <= 200000; base += 100) {
    const f = calculateFees(base, DEFAULT_PRICING);
    assert.equal(f.totalPaise, f.basePaise + f.convenienceFeePaise + f.gstOnConvenienceFeePaise - f.discountPaise);
    assert.equal(f.venuePayoutPaise, f.basePaise - f.commissionPaise - f.gstOnCommissionPaise);
    assert.ok(f.venuePayoutPaise > 0);
  }
});
test('fees: rounding is half-up and integer-only', () => {
  assert.equal(applyBps(5, 1000), 1);   // 0.5 → 1
  assert.equal(applyBps(4, 1000), 0);   // 0.4 → 0
  assert.equal(applyBps(15, 1000), 2);  // 1.5 → 2
  assert.throws(() => applyBps(1.5, 100));
  assert.throws(() => calculateFees(0, DEFAULT_PRICING));
});

const base = { basePaise: 40000, convenienceFeePaise: 2000, gstOnConvenienceFeePaise: 360, totalPaise: 42360, venuePayoutPaise: 35280, commissionBps: 1000, gstBps: 1800 };
const start = new Date('2026-11-01T12:30:00Z');
const hoursBefore = (h: number) => new Date(start.getTime() - h * 3_600_000);

test('refund: >24h → 100 % of base, fee kept', () => {
  const r = computeRefund({ ...base, cancelledBy: 'USER', startTime: start, now: hoursBefore(30) });
  assert.equal(r.tier, 'GT_24H'); assert.equal(r.refundPaise, 40000); assert.equal(r.nonRefundableFeePaise, 2360);
  assert.equal(r.transferReversalPaise, 35280); assert.equal(r.venueKeepsPayoutPaise, 0);
});
test('refund: exactly 24h is the 100 % tier; exactly 12h is the 50 % tier', () => {
  assert.equal(computeRefund({ ...base, cancelledBy: 'USER', startTime: start, now: hoursBefore(24) }).tier, 'GT_24H');
  assert.equal(computeRefund({ ...base, cancelledBy: 'USER', startTime: start, now: hoursBefore(12) }).tier, 'H12_24');
});
test('refund: 12–24h → 50 % and money balances', () => {
  const r = computeRefund({ ...base, cancelledBy: 'USER', startTime: start, now: hoursBefore(18) });
  assert.equal(r.refundPaise, 20000); assert.equal(r.venueKeepsPayoutPaise, 17640); assert.equal(r.transferReversalPaise, 17640);
  // platform keeps: total received − refund − venue payout = fee + gst + commission + gst-on-commission
  assert.equal(base.totalPaise - r.refundPaise - r.venueKeepsPayoutPaise, 2000 + 360 + 2000 + 360);
});
test('refund: <12h and after start → 0', () => {
  assert.equal(computeRefund({ ...base, cancelledBy: 'USER', startTime: start, now: hoursBefore(3) }).refundPaise, 0);
  const after = computeRefund({ ...base, cancelledBy: 'USER', startTime: start, now: hoursBefore(-1) });
  assert.equal(after.tier, 'AFTER_START'); assert.equal(after.refundPaise, 0);
});
test('refund: venue cancel and slot-unavailable → full total including fee', () => {
  for (const extra of [{ cancelledBy: 'VENUE' as const }, { cancelledBy: 'USER' as const, slotUnavailable: true }]) {
    const r = computeRefund({ ...base, ...extra, startTime: start, now: hoursBefore(1) });
    assert.equal(r.refundPaise, 42360); assert.equal(r.transferReversalPaise, 35280); assert.equal(r.nonRefundableFeePaise, 0);
  }
});
test('refund: custom venue policy', () => {
  const r = computeRefund({ ...base, cancelledBy: 'USER', startTime: start, now: hoursBefore(5),
    tiers: [{ minHoursBefore: 4, refundBps: 7500, code: 'CUSTOM_4H' }, { minHoursBefore: 0, refundBps: 0, code: 'CUSTOM_0' }] });
  assert.equal(r.tier, 'CUSTOM_4H'); assert.equal(r.refundPaise, 30000);
});

test('reliability: worked examples', () => {
  assert.equal(reliabilityScore({ attended: 10, noShows: 0, lateCancels: 0 }).score, 100);
  assert.equal(reliabilityScore({ attended: 9, noShows: 1, lateCancels: 0 }).score, 79);
  assert.equal(reliabilityScore({ attended: 18, noShows: 0, lateCancels: 2 }).score, 91);
  assert.equal(reliabilityScore({ attended: 8, noShows: 2, lateCancels: 0 }).score, 63);
  assert.equal(reliabilityScore({ attended: 2, noShows: 1, lateCancels: 0 }).tier, 'NEW');
  assert.equal(reliabilityScore({ attended: 8, noShows: 2, lateCancels: 0 }).tier, 'AT_RISK');
  assert.equal(reliabilityScore({ attended: 9, noShows: 1, lateCancels: 0 }).tier, 'STANDARD');
});
test('reliability: bounded, and old misses age out of the window', () => {
  assert.equal(reliabilityScore({ attended: 0, noShows: 50, lateCancels: 0 }).score >= 0, true);
  const outcomes = [...Array(20).fill('ATTENDED'), 'NO_SHOW', 'NO_SHOW'] as Array<'ATTENDED' | 'NO_SHOW'>;
  assert.equal(reliabilityScore(windowOutcomes(outcomes)).score, 100); // newest-first, the two misses are outside the window
});

const court = { slotMinutes: 60, baseHourlyRatePaise: 35000 };
const schedule = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, openMinute: 360, closeMinute: 1320 })); // 06:00–22:00
const peak = [{ daysOfWeek: [1, 2, 3, 4, 5], startMinute: 1080, endMinute: 1260, hourlyRatePaise: 45000, priority: 1 }]; // 18:00–21:00
const now = new Date('2026-10-30T00:00:00Z');

test('availability: IST day boundaries and weekday', () => {
  assert.equal(istDayStart('2026-11-01').toISOString(), '2026-10-31T18:30:00.000Z');
  assert.equal(isoWeekday('2026-11-01'), 7); // Sunday
  assert.equal(isoWeekday('2026-11-02'), 1); // Monday
  assert.throws(() => istDayStart('2026-02-30'));
});
test('availability: 16 hourly slots, peak pricing on weekdays only', () => {
  const mon = computeDaySlots({ dateStr: '2026-11-02', court, schedule, rules: peak, blocks: [], liveBookings: [], now, advanceBookingDays: 14 });
  assert.equal(mon.length, 16);
  assert.equal(mon[0]!.startTime.toISOString(), '2026-11-02T00:30:00.000Z'); // 06:00 IST
  assert.equal(slotPricePaise(court, peak, '2026-11-02', 18 * 60), 45000);
  assert.equal(slotPricePaise(court, peak, '2026-11-02', 21 * 60), 35000); // end exclusive
  assert.equal(slotPricePaise(court, peak, '2026-11-01', 18 * 60), 35000); // Sunday
});
test('availability: bookings, blocks, past and horizon states; adjacency is not overlap', () => {
  const live = [{ startTime: new Date('2026-11-02T12:30:00Z'), endTime: new Date('2026-11-02T13:30:00Z') }]; // 18:00–19:00 IST
  const blocks = [{ startTime: new Date('2026-11-02T01:30:00Z'), endTime: new Date('2026-11-02T03:30:00Z') }]; // 07:00–09:00 IST
  const s = computeDaySlots({ dateStr: '2026-11-02', court, schedule, rules: peak, blocks, liveBookings: live, now, advanceBookingDays: 14 });
  const at = (h: number) => s.find((x) => x.startTime.getTime() === istDayStart('2026-11-02').getTime() + h * 3_600_000)!;
  assert.equal(at(18).state, 'BOOKED'); assert.equal(at(17).state, 'AVAILABLE'); assert.equal(at(19).state, 'AVAILABLE');
  assert.equal(at(7).state, 'BLOCKED'); assert.equal(at(8).state, 'BLOCKED'); assert.equal(at(9).state, 'AVAILABLE');
  const far = computeDaySlots({ dateStr: '2026-12-25', court, schedule, rules: [], blocks: [], liveBookings: [], now, advanceBookingDays: 14 });
  assert.ok(far.every((x) => x.state === 'TOO_FAR'));
  const past = computeDaySlots({ dateStr: '2026-10-29', court, schedule, rules: [], blocks: [], liveBookings: [], now, advanceBookingDays: 14 });
  assert.ok(past.every((x) => x.state === 'PAST'));
});
test('availability: priceInterval sums slots and rejects gaps/unavailable', () => {
  const s = computeDaySlots({ dateStr: '2026-11-02', court, schedule, rules: peak, blocks: [], liveBookings: [], now, advanceBookingDays: 14 });
  const t = (h: number) => new Date(istDayStart('2026-11-02').getTime() + h * 3_600_000);
  assert.equal(priceInterval(s, t(17), t(19)), 35000 + 45000);
  assert.throws(() => priceInterval(s, t(17), new Date(t(19).getTime() + 1)));
  assert.throws(() => priceInterval(s, t(22), t(23))); // outside opening hours
});
test('availability: 30-minute grid prices pro-rata', () => {
  const half = { slotMinutes: 30, baseHourlyRatePaise: 35000 };
  assert.equal(slotPricePaise(half, [], '2026-11-02', 360), 17500);
});
