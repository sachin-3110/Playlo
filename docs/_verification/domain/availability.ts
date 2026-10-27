// packages/domain/src/availability.ts — pure. Computes a court-day grid from rules + bookings.
// India observes no DST, so a fixed +05:30 offset is correct for Asia/Kolkata. All IST handling lives here.

export const IST_OFFSET_MIN = 330;
const MS_MIN = 60_000;

export interface CourtConfig { slotMinutes: number; baseHourlyRatePaise: number; }
export interface ScheduleWindow { dayOfWeek: number; openMinute: number; closeMinute: number; } // ISO 1..7
export interface PriceRule {
  daysOfWeek: number[]; startMinute: number; endMinute: number; hourlyRatePaise: number; priority: number;
  validFrom?: string | null; validTo?: string | null; // 'YYYY-MM-DD' inclusive
}
export interface Interval { startTime: Date; endTime: Date; }

export type SlotState = 'AVAILABLE' | 'BOOKED' | 'BLOCKED' | 'CLOSED' | 'PAST' | 'TOO_FAR';
export interface Slot { startTime: Date; endTime: Date; pricePaise: number; state: SlotState; }

/** Local midnight of 'YYYY-MM-DD' (IST) as a UTC instant. */
export function istDayStart(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new RangeError('date must be YYYY-MM-DD');
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = Date.UTC(y, mo - 1, d, 0, 0, 0, 0);
  if (new Date(utc).getUTCDate() !== d) throw new RangeError('invalid calendar date');
  return new Date(utc - IST_OFFSET_MIN * MS_MIN);
}

export function isoWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

const overlaps = (a: Interval, b: Interval) => a.startTime < b.endTime && b.startTime < a.endTime; // half-open

export function slotPricePaise(court: CourtConfig, rules: PriceRule[], dateStr: string, startMinute: number): number {
  const dow = isoWeekday(dateStr);
  const match = rules
    .filter((r) =>
      r.daysOfWeek.includes(dow) && r.startMinute <= startMinute && startMinute < r.endMinute &&
      (!r.validFrom || dateStr >= r.validFrom) && (!r.validTo || dateStr <= r.validTo))
    .sort((a, b) => b.priority - a.priority)[0];
  const hourly = match ? match.hourlyRatePaise : court.baseHourlyRatePaise;
  return Math.round((hourly * court.slotMinutes) / 60);
}

export interface DayInput {
  dateStr: string;
  court: CourtConfig;
  schedule: ScheduleWindow[];
  rules: PriceRule[];
  blocks: Interval[];
  liveBookings: Interval[]; // already filtered by the "live" definition in docs/03 §3.1
  now: Date;
  advanceBookingDays: number;
}

export function computeDaySlots(i: DayInput): Slot[] {
  const dow = isoWeekday(i.dateStr);
  const dayStart = istDayStart(i.dateStr).getTime();
  const horizon = i.now.getTime() + i.advanceBookingDays * 86_400_000;
  const slots: Slot[] = [];

  for (const w of i.schedule.filter((s) => s.dayOfWeek === dow).sort((a, b) => a.openMinute - b.openMinute)) {
    for (let m = w.openMinute; m + i.court.slotMinutes <= w.closeMinute; m += i.court.slotMinutes) {
      const startTime = new Date(dayStart + m * MS_MIN);
      const endTime = new Date(dayStart + (m + i.court.slotMinutes) * MS_MIN);
      const iv = { startTime, endTime };
      let state: SlotState = 'AVAILABLE';
      if (endTime <= i.now) state = 'PAST';
      else if (startTime.getTime() > horizon) state = 'TOO_FAR';
      else if (i.blocks.some((b) => overlaps(iv, b))) state = 'BLOCKED';
      else if (i.liveBookings.some((b) => overlaps(iv, b))) state = 'BOOKED';
      slots.push({ ...iv, pricePaise: slotPricePaise(i.court, i.rules, i.dateStr, m), state });
    }
  }
  return slots;
}

/** Price of a requested interval; throws if it is not an exact run of AVAILABLE slots. */
export function priceInterval(slots: Slot[], start: Date, end: Date): number {
  const covered = slots.filter((s) => s.startTime >= start && s.endTime <= end);
  const contiguous =
    covered.length > 0 &&
    covered[0]!.startTime.getTime() === start.getTime() &&
    covered[covered.length - 1]!.endTime.getTime() === end.getTime() &&
    covered.every((s, idx) => idx === 0 || covered[idx - 1]!.endTime.getTime() === s.startTime.getTime());
  if (!contiguous || covered.some((s) => s.state !== 'AVAILABLE')) throw new RangeError('interval not bookable');
  return covered.reduce((sum, s) => sum + s.pricePaise, 0);
}
