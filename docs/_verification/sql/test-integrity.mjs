import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const env = { ...process.env, DATABASE_URL: 'postgresql://u:p@localhost:5432/x', DIRECT_DATABASE_URL: 'postgresql://u:p@localhost:5432/x' };
let ddl = execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { env, encoding: 'utf8', shell: true });
ddl = ddl.replace(/CREATE EXTENSION IF NOT EXISTS "postgis";/, '').replace('CREATE SCHEMA IF NOT EXISTS "public";', '');
const prelude = 'CREATE SEQUENCE IF NOT EXISTS booking_number_seq; CREATE SEQUENCE IF NOT EXISTS payment_number_seq;';
const integrity = readFileSync('sql/integrity.sql', 'utf8');

const db = new PGlite({ extensions: { btree_gist } });
await db.exec('CREATE EXTENSION IF NOT EXISTS btree_gist;');
await db.exec(prelude);
await db.exec(ddl);
await db.exec(integrity);
console.log('DDL + integrity applied OK');

const results = [];
const check = async (name, fn, expectErr) => {
  try { await fn(); results.push([name, expectErr ? 'FAIL (expected error)' : 'ok']); }
  catch (e) { results.push([name, expectErr && e.message.includes(expectErr) ? 'ok (rejected)' : 'FAIL: ' + e.message]); }
};

await db.exec(`INSERT INTO users (id, phone, "updatedAt") VALUES ('u1','+919812345678', now()), ('u2','+919812345679', now());
INSERT INTO sports (id, slug, name) VALUES ('s1','badminton','Badminton');
INSERT INTO venues (id,name,slug,"addressLine1",latitude,longitude,phone,"ownerId","updatedAt") VALUES ('v1','V','v','x',29.5,75.0,'1','u1', now());
INSERT INTO courts (id,"venueId","sportId",name,"baseHourlyRatePaise","updatedAt") VALUES ('c1','v1','s1','C1',40000, now()), ('c2','v1','s1','C2',40000, now());`);

const ins = (id, court, s, e, status, key) => db.exec(`INSERT INTO bookings (id,"userId","courtId","startTime","endTime",status,"holdExpiresAt","idempotencyKey",
 "baseAmountPaise","convenienceFeePaise","gstOnConvenienceFeePaise","totalAmountPaise","commissionPaise","gstOnCommissionPaise","venuePayoutPaise","pricingConfigVersion","updatedAt")
 VALUES ('${id}','u1','${court}','${s}','${e}','${status}', now() + interval '5 minutes','${key}',40000,2000,360,42360,4000,720,35280,1, now())`);

await check('first booking', () => ins('b1','c1','2026-11-01T18:00:00Z','2026-11-01T19:00:00Z','PENDING','k1'));
await check('exact overlap rejected', () => ins('b2','c1','2026-11-01T18:00:00Z','2026-11-01T19:00:00Z','PENDING','k2'), 'bookings_no_overlap');
await check('partial overlap rejected', () => ins('b3','c1','2026-11-01T18:30:00Z','2026-11-01T19:30:00Z','CONFIRMED','k3'), 'bookings_no_overlap');
await check('adjacent slot allowed ([) half-open)', () => ins('b4','c1','2026-11-01T19:00:00Z','2026-11-01T20:00:00Z','PENDING','k4'));
await check('other court same time allowed', () => ins('b5','c2','2026-11-01T18:00:00Z','2026-11-01T19:00:00Z','PENDING','k5'));
await check('expire frees the slot', async () => {
  await db.exec(`UPDATE bookings SET status='EXPIRED' WHERE id='b1'`);
  await ins('b6','c1','2026-11-01T18:00:00Z','2026-11-01T19:00:00Z','PENDING','k6');
});
await check('reviving expired booking blocked while slot re-taken', () => db.exec(`UPDATE bookings SET status='CONFIRMED' WHERE id='b1'`), 'bookings_no_overlap');
await check('inconsistent total rejected', () => db.exec(`INSERT INTO bookings (id,"userId","courtId","startTime","endTime",status,"holdExpiresAt","idempotencyKey","baseAmountPaise","convenienceFeePaise","gstOnConvenienceFeePaise","totalAmountPaise","commissionPaise","gstOnCommissionPaise","venuePayoutPaise","pricingConfigVersion","updatedAt") VALUES ('bx','u1','c2','2026-11-02T10:00:00Z','2026-11-02T11:00:00Z','PENDING', now(),'kx',40000,2000,360,99999,4000,720,35280,1, now())`), 'bookings_total_consistent');
await check('PENDING without hold rejected', () => db.exec(`UPDATE bookings SET "holdExpiresAt"=NULL WHERE id='b6'`), 'bookings_pending_has_hold');
await check('booking number generated', async () => {
  const r = await db.query(`SELECT "bookingNumber" FROM bookings WHERE id='b1'`);
  if (!/^BK-\d{4}-\d{6}$/.test(r.rows[0].bookingNumber)) throw new Error('bad format ' + r.rows[0].bookingNumber);
  console.log('   sample bookingNumber:', r.rows[0].bookingNumber);
});
await check('bad phone rejected', () => db.exec(`INSERT INTO users (id, phone, "updatedAt") VALUES ('u3','9812345678', now())`), 'users_phone_e164');
await check('user without identifier rejected', () => db.exec(`INSERT INTO users (id, "updatedAt") VALUES ('u4', now())`), 'users_has_identifier');
await check('game over-capacity rejected', () => db.exec(`INSERT INTO games (id,"shareCode",title,"sportId","hostId","startTime","endTime","maxParticipants","confirmedCount","updatedAt") VALUES ('g1','ABCD2345','t','s1','u1','2026-11-01T18:00:00Z','2026-11-01T19:00:00Z',4,5, now())`), 'games_count_in_range');
await check('game ok', () => db.exec(`INSERT INTO games (id,"shareCode",title,"sportId","hostId","startTime","endTime","maxParticipants","confirmedCount","updatedAt") VALUES ('g2','ABCD2346','t','s1','u1','2026-11-01T18:00:00Z','2026-11-01T19:00:00Z',4,1, now())`));
await check('atomic join UPDATE caps at capacity', async () => {
  let n = 0;
  for (let i = 0; i < 6; i++) {
    const r = await db.query(`UPDATE games SET "confirmedCount" = "confirmedCount"+1 WHERE id='g2' AND status='OPEN' AND "confirmedCount" < "maxParticipants" RETURNING id`);
    n += r.rows.length;
  }
  if (n !== 3) throw new Error('expected 3 successful joins, got ' + n);
});
await check('one success payment per booking', async () => {
  await db.exec(`INSERT INTO payments (id,"bookingId","userId","amountPaise",status,"razorpayOrderId","idempotencyKey","updatedAt") VALUES ('p1','b6','u1',42360,'SUCCEEDED','order_1','ik1', now())`);
  await db.exec(`INSERT INTO payments (id,"bookingId","userId","amountPaise",status,"razorpayOrderId","idempotencyKey","updatedAt") VALUES ('p2','b6','u1',42360,'FAILED','order_2','ik2', now())`);
});
await check('second success payment rejected', () => db.exec(`INSERT INTO payments (id,"bookingId","userId","amountPaise",status,"razorpayOrderId","idempotencyKey","updatedAt") VALUES ('p3','b6','u1',42360,'SUCCEEDED','order_3','ik3', now())`), 'payments_one_success_per_booking');
await check('audit log insert ok', () => db.exec(`INSERT INTO audit_logs (id, action, "entityType","entityId") VALUES ('a1','X','Venue','v1')`));
await check('audit log update blocked', () => db.exec(`UPDATE audit_logs SET action='Y' WHERE id='a1'`), 'append-only');
await check('audit log delete blocked', () => db.exec(`DELETE FROM audit_logs WHERE id='a1'`), 'append-only');
await check('advisory lock hashtextextended works', async () => {
  await db.exec(`BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('c1', 0)); COMMIT;`);
});

for (const [n, r] of results) console.log((r.startsWith('ok') ? 'PASS ' : 'FAIL ') + n + '  → ' + r);
const failed = results.filter(([, r]) => r.startsWith('FAIL')).length;
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
