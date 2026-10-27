-- packages/db/prisma/migrations/0002_integrity/migration.sql
-- Hand-written. Run AFTER the Prisma-generated DDL for the same schema version.
-- Identifiers are quoted camelCase because the Prisma schema does not @map columns.

-- ───────────── Bookings: the double-booking guarantee ─────────────
-- Two live bookings for the same court may never overlap. This is the real
-- guarantee; Redis holds and advisory locks only make failures cheap and polite.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "courtId" WITH =,
    tstzrange("startTime", "endTime", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'COMPLETED'));

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_interval_valid"   CHECK ("endTime" > "startTime"),
  ADD CONSTRAINT "bookings_amounts_valid"    CHECK (
    "baseAmountPaise" > 0 AND "convenienceFeePaise" >= 0 AND "gstOnConvenienceFeePaise" >= 0
    AND "discountPaise" >= 0 AND "commissionPaise" >= 0 AND "gstOnCommissionPaise" >= 0
    AND "venuePayoutPaise" >= 0 AND "totalAmountPaise" > 0),
  ADD CONSTRAINT "bookings_total_consistent" CHECK (
    "totalAmountPaise" = "baseAmountPaise" + "convenienceFeePaise" + "gstOnConvenienceFeePaise" - "discountPaise"),
  ADD CONSTRAINT "bookings_payout_consistent" CHECK (
    "venuePayoutPaise" = "baseAmountPaise" - "commissionPaise" - "gstOnCommissionPaise"),
  ADD CONSTRAINT "bookings_pending_has_hold" CHECK (
    "status" <> 'PENDING' OR "holdExpiresAt" IS NOT NULL);

-- ───────────── Payments, refunds, transfers ─────────────
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_positive" CHECK ("amountPaise" > 0),
  ADD CONSTRAINT "payments_purpose_target"  CHECK ("purpose" <> 'COURT_BOOKING' OR "bookingId" IS NOT NULL);

-- At most one successful payment per booking (retries reuse the same order).
CREATE UNIQUE INDEX "payments_one_success_per_booking"
  ON "payments" ("bookingId")
  WHERE "status" IN ('SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED');

ALTER TABLE "refunds"   ADD CONSTRAINT "refunds_amount_positive"   CHECK ("amountPaise" > 0);
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_amounts_valid"   CHECK ("amountPaise" >= 0 AND "reversedPaise" BETWEEN 0 AND "amountPaise");

-- ───────────── Games ─────────────
ALTER TABLE "games"
  ADD CONSTRAINT "games_interval_valid"  CHECK ("endTime" > "startTime"),
  ADD CONSTRAINT "games_capacity_valid"  CHECK ("maxParticipants" >= 2 AND "minParticipants" BETWEEN 1 AND "maxParticipants"),
  ADD CONSTRAINT "games_count_in_range"  CHECK ("confirmedCount" BETWEEN 0 AND "maxParticipants"),
  ADD CONSTRAINT "games_cost_valid"      CHECK ("costPerPlayerPaise" >= 0);

-- ───────────── Court configuration ─────────────
ALTER TABLE "courts"
  ADD CONSTRAINT "courts_rate_valid"     CHECK ("baseHourlyRatePaise" > 0),
  ADD CONSTRAINT "courts_slot_valid"     CHECK ("slotMinutes" IN (15, 30, 60)),
  ADD CONSTRAINT "courts_duration_valid" CHECK (
    "minDurationMinutes" >= "slotMinutes" AND "maxDurationMinutes" >= "minDurationMinutes"
    AND "minDurationMinutes" % "slotMinutes" = 0 AND "maxDurationMinutes" % "slotMinutes" = 0);

ALTER TABLE "court_schedules"
  ADD CONSTRAINT "court_schedules_valid" CHECK (
    "dayOfWeek" BETWEEN 1 AND 7 AND "openMinute" >= 0 AND "closeMinute" <= 1440 AND "openMinute" < "closeMinute");

ALTER TABLE "pricing_rules"
  ADD CONSTRAINT "pricing_rules_valid" CHECK (
    "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute" AND "hourlyRatePaise" > 0);

ALTER TABLE "court_blocks"
  ADD CONSTRAINT "court_blocks_interval_valid" CHECK ("endTime" > "startTime");

-- ───────────── Users ─────────────
ALTER TABLE "users"
  ADD CONSTRAINT "users_has_identifier" CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL),
  ADD CONSTRAINT "users_phone_e164"     CHECK ("phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{7,14}$');

-- ───────────── Audit log is append-only ─────────────
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed (append-only table)', TG_OP, TG_TABLE_NAME;
END $$;

CREATE TRIGGER "audit_logs_append_only"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
