import type { GuestRange, MediaPackage } from "../../generated/prisma/enums.js";

/**
 * Single source of truth for custom event pricing.
 * All money in the app is stored as integer poisha (1 BDT = 100 poisha);
 * the `*Cents` column names mean "minor currency unit".
 */
const taka = (amount: number) => amount * 100;

export const PRICING = {
  guestRange: { UP_TO_250: taka(150_000), UP_TO_500: taka(280_000), UP_TO_1000: taka(450_000) } satisfies Record<GuestRange, number>,
  mediaPackage: { NONE: 0, PHOTOGRAPHY: taka(25_000), VIDEOGRAPHY: taka(35_000), PHOTO_AND_VIDEO: taka(50_000) } satisfies Record<MediaPackage, number>,
  catering: taka(100_000),
};

export function estimateCost(guestRange: GuestRange, mediaPackage: MediaPackage, catering: boolean) {
  return PRICING.guestRange[guestRange] + PRICING.mediaPackage[mediaPackage] + (catering ? PRICING.catering : 0);
}

export const EVENT_TYPES = ["Wedding", "Birthday", "Anniversary", "Corporate Event", "Arts & Culture Festival", "Concert", "Conference", "Other"] as const;
