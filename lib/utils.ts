import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import { APP_TIME_ZONE } from "@/lib/time";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: string | null) {
  if (!value) return "Not scheduled";
  // Pinned to IST: without an explicit timeZone this renders in the *renderer's* zone, so a
  // server component printed UTC on Vercel while the browser printed IST for the same row.
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE
  }).format(new Date(value));
}

export function timeAgo(value: string, now: Date = new Date()) {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  return trimmed.length ? trimmed : null;
}

export function generateInviteCode(length = 7) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}
