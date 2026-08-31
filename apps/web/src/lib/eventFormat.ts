import type { EventAudience } from "./api";

// The club runs on Africa/Nairobi time (UTC+3, no DST) — admin forms collect
// a plain wall-clock datetime-local value with no timezone of its own, so we
// pin it to that fixed offset before sending it to the API as a real instant.
const CLUB_UTC_OFFSET = "+03:00";

export function localInputToIso(value: string): string {
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return new Date(`${withSeconds}${CLUB_UTC_OFFSET}`).toISOString();
}

export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const nairobi = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return nairobi.toISOString().slice(0, 16);
}

export function formatEventDay(iso: string): { dow: string; day: string; mon: string } {
  const d = new Date(iso);
  return {
    dow: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    day: String(d.getDate()).padStart(2, "0"),
    mon: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
  };
}

export function formatEventDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "long" });
}

export function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatEventMeta(e: { starts_at: string; venue: string; speaker_name?: string | null }): string {
  return [formatEventTime(e.starts_at), e.venue, e.speaker_name].filter(Boolean).join(" · ");
}

export function audienceLabel(a: EventAudience): "open to all" | "members only" {
  return a === "open_to_all" ? "open to all" : "members only";
}

export function feeLabel(feeKes: number): string {
  return feeKes > 0 ? `KSh ${feeKes}` : "free";
}

export function capacityLabel(capacity: number | null, seatsLeft: number | null): string {
  if (capacity === null) return "no cap";
  if (seatsLeft !== null && seatsLeft <= 0) return "full";
  return `${seatsLeft} of ${capacity} seats left`;
}

export function registerCta(capacity: number | null, seatsLeft: number | null): string {
  return capacity !== null && seatsLeft !== null && seatsLeft <= 0 ? "Join waitlist" : "Register";
}
