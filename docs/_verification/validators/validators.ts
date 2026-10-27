// packages/validators/src/index.ts  (Zod 4)
import { z } from 'zod';

export const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'COMPETITIVE'] as const;
export const SportFormatSchema = z.enum(['SINGLES', 'DOUBLES', 'ANY']);
export const SkillLevelSchema = z.enum(SKILL_LEVELS);
export const VisibilitySchema = z.enum(['PUBLIC', 'PRIVATE_INVITE', 'COMMUNITY_ONLY']);
export const JoinPolicySchema = z.enum(['OPEN', 'APPROVAL']);

const skillRank = (s: (typeof SKILL_LEVELS)[number]) => SKILL_LEVELS.indexOf(s);

/** ISO-8601 instant from the client → Date. Reject anything without an explicit zone. */
export const InstantSchema = z.iso.datetime({ offset: true }).transform((s) => new Date(s));

export const IdempotencyKeySchema = z.uuid();
export const PhoneSchema = z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter a valid Indian mobile number'); // launch market only
export const OtpSchema = z.string().regex(/^\d{6}$/);

export const CreateGameSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    sportSlug: z.string().min(1).max(40),                 // existence/active checked in the service against Sport
    startTime: InstantSchema,
    endTime: InstantSchema,
    format: SportFormatSchema.default('DOUBLES'),
    minSkillLevel: SkillLevelSchema.default('BEGINNER'),
    maxSkillLevel: SkillLevelSchema.default('COMPETITIVE'),
    minParticipants: z.number().int().min(2).max(12).default(2),
    maxParticipants: z.number().int().min(2).max(12).default(4),
    costPerPlayerPaise: z.number().int().min(0).max(500_000).default(0), // ≤ ₹5 000; informational in Phase 1
    joinPolicy: JoinPolicySchema.default('OPEN'),
    visibility: VisibilitySchema.default('PUBLIC'),
    venueId: z.cuid2().optional(),
    bookingId: z.cuid2().optional(),
    communityId: z.cuid2().optional(),
    customLocationName: z.string().trim().max(100).optional(),
    rulesDescription: z.string().trim().max(1000).optional(),
    publish: z.boolean().default(true),                    // false → DRAFT
  })
  .superRefine((g, ctx) => {
    if (g.endTime <= g.startTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be after start time' });
    if (g.startTime.getTime() < Date.now() + 15 * 60_000) ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Start time must be at least 15 minutes from now' });
    if (g.endTime.getTime() - g.startTime.getTime() > 8 * 3_600_000) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Games cannot exceed 8 hours' });
    if (skillRank(g.minSkillLevel) > skillRank(g.maxSkillLevel)) ctx.addIssue({ code: 'custom', path: ['minSkillLevel'], message: 'Minimum skill cannot exceed maximum' });
    if (g.minParticipants > g.maxParticipants) ctx.addIssue({ code: 'custom', path: ['minParticipants'], message: 'Minimum cannot exceed maximum players' });
    if (!g.venueId && !g.customLocationName) ctx.addIssue({ code: 'custom', path: ['customLocationName'], message: 'Choose a venue or enter a location' });
    if (g.bookingId && !g.venueId) ctx.addIssue({ code: 'custom', path: ['venueId'], message: 'A booking requires its venue' });
  });

export const ListGamesSchema = z.object({
  city: z.string().default('Sirsa'),
  sportSlug: z.string().default('badminton'),
  date: z.iso.date().optional(),                          // local (IST) calendar day
  skillLevel: SkillLevelSchema.optional(),
  format: SportFormatSchema.optional(),
  maxFeePaise: z.number().int().min(0).optional(),
  nearLat: z.number().min(-90).max(90).optional(),
  nearLng: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().min(1).max(50).default(10),
  onlyWithSeats: z.boolean().default(true),
  cursor: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const InitiateHoldSchema = z.object({
  courtId: z.cuid2(),
  startTime: InstantSchema,
  endTime: InstantSchema,
  idempotencyKey: IdempotencyKeySchema,
  gameId: z.cuid2().optional(),
}).refine((v) => v.endTime > v.startTime, { path: ['endTime'], message: 'End time must be after start time' });

export const CreateOrderSchema = z.object({ bookingId: z.cuid2(), idempotencyKey: IdempotencyKeySchema });

export const VerifyPaymentSchema = z.object({
  razorpayOrderId: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpayPaymentId: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/),
});

export const SendOtpSchema = z.object({ phone: PhoneSchema });
export const VerifyOtpSchema = z.object({ phone: PhoneSchema, code: OtpSchema });
