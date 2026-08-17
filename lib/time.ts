// Every wall-clock time in the app means IST: what a teacher types into the schedule form
// and what a student reads back. Pinning it here keeps that meaning identical wherever the
// code runs — Node on Vercel is UTC, the owner's Mac is IST, and a browser is whatever the
// student's device says. Without this, the same form input produced different instants
// depending on which machine executed the server action.
export const APP_TIME_ZONE = "Asia/Kolkata";

const INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

// Minutes that APP_TIME_ZONE is ahead of UTC at a given instant.
function zoneOffsetMinutes(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const wallClock = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return (wallClock - instant.getTime()) / 60_000;
}

// Start of the current IST calendar month, as a UTC instant.
//
// `new Date(); setDate(1); setHours(0,0,0,0)` computes this in the *process's* zone, so on
// Vercel (UTC) the monthly AI cap rolled over at 05:30 IST on the 1st — the same defect
// shape as the test scheduled for 12:30 AM that went live at 6:00.
export function monthStartUtcIso(now: Date = new Date()) {
  const istWallClock = utcIsoToScheduleInput(now.toISOString());
  return scheduleInputToUtcIso(`${istWallClock.slice(0, 7)}-01T00:00`) as string;
}

// Inverse of scheduleInputToUtcIso: renders a stored instant as the IST wall clock that a
// <input type="datetime-local"> expects, so the reschedule form prefills with the time the
// teacher originally set rather than a UTC one.
export function utcIsoToScheduleInput(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// A <input type="datetime-local"> value ("2026-07-28T00:30") carries no timezone, so
// `new Date(value)` resolves it in the *process's* zone. Resolve it in APP_TIME_ZONE.
// Returns null on a malformed value so callers can reject rather than store a bad instant.
export function scheduleInputToUtcIso(value: string) {
  const match = INPUT_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const asIfUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    second ? Number(second) : 0
  );

  // Guess using the offset at that instant, then correct once. A second pass settles it:
  // the offset is constant except across a DST boundary, and IST has no DST at all.
  const firstPass = asIfUtc - zoneOffsetMinutes(new Date(asIfUtc)) * 60_000;
  const settled = asIfUtc - zoneOffsetMinutes(new Date(firstPass)) * 60_000;

  return new Date(settled).toISOString();
}
