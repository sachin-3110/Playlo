import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateGameSchema, InitiateHoldSchema, PhoneSchema, VerifyPaymentSchema, ListGamesSchema } from './validators.ts';

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const ok = { title: 'Sunday doubles', sportSlug: 'badminton', startTime: inHours(48), endTime: inHours(50), customLocationName: 'Sector 20 park' };

test('CreateGame: valid minimal input gets defaults and Date objects', () => {
  const g = CreateGameSchema.parse(ok);
  assert.ok(g.startTime instanceof Date); assert.equal(g.maxParticipants, 4); assert.equal(g.joinPolicy, 'OPEN'); assert.equal(g.publish, true);
});
test('CreateGame: rejects naive timestamps without a zone', () => {
  assert.throws(() => CreateGameSchema.parse({ ...ok, startTime: '2026-11-01T18:00:00' }));
});
test('CreateGame: cross-field rules', () => {
  assert.throws(() => CreateGameSchema.parse({ ...ok, endTime: ok.startTime }), /End time/);
  assert.throws(() => CreateGameSchema.parse({ ...ok, startTime: inHours(0.1), endTime: inHours(2) }), /15 minutes/);
  assert.throws(() => CreateGameSchema.parse({ ...ok, minSkillLevel: 'ADVANCED', maxSkillLevel: 'BEGINNER' }), /Minimum skill/);
  assert.throws(() => CreateGameSchema.parse({ ...ok, minParticipants: 5, maxParticipants: 4 }));
  assert.throws(() => CreateGameSchema.parse({ ...ok, customLocationName: undefined }), /venue or enter/);
  assert.throws(() => CreateGameSchema.parse({ ...ok, endTime: inHours(60) }), /8 hours/);
  assert.throws(() => CreateGameSchema.parse({ ...ok, bookingId: 'ckx1234567890abcdefghijklm' }));
});
test('InitiateHold: needs uuid idempotency key and ordered instants', () => {
  const base = { courtId: 'ckx1234567890abcdefghijk', startTime: inHours(5), endTime: inHours(6), idempotencyKey: crypto.randomUUID() };
  assert.ok(InitiateHoldSchema.parse(base));
  assert.throws(() => InitiateHoldSchema.parse({ ...base, idempotencyKey: 'abc' }));
  assert.throws(() => InitiateHoldSchema.parse({ ...base, endTime: base.startTime }));
});
test('Phone: only Indian mobiles in launch market', () => {
  assert.ok(PhoneSchema.parse('+919812345678'));
  for (const bad of ['9812345678', '+911234567890', '+14155550123', '+91981234567']) assert.throws(() => PhoneSchema.parse(bad));
});
test('VerifyPayment: shape of Razorpay identifiers', () => {
  assert.ok(VerifyPaymentSchema.parse({ razorpayOrderId: 'order_Abc123', razorpayPaymentId: 'pay_Xyz789', razorpaySignature: 'a'.repeat(64) }));
  assert.throws(() => VerifyPaymentSchema.parse({ razorpayOrderId: 'x', razorpayPaymentId: 'pay_1', razorpaySignature: 'zz' }));
});
test('ListGames: limits are bounded', () => {
  assert.equal(ListGamesSchema.parse({}).limit, 20);
  assert.throws(() => ListGamesSchema.parse({ limit: 500 }));
});
