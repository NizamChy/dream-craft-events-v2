import type { GuestRange, MediaPackage } from "./types";

export interface PlanPrefill {
  eventType?: string;
  guestRange?: GuestRange;
  mediaPackage?: MediaPackage;
  catering?: boolean;
}

const GUESTS: GuestRange[] = ["UP_TO_250", "UP_TO_500", "UP_TO_1000"];
const MEDIA: MediaPackage[] = ["NONE", "PHOTOGRAPHY", "VIDEOGRAPHY", "PHOTO_AND_VIDEO"];

/** Reads a plan-your-event prefill from the URL, e.g. the chatbot's "Send this request" link. */
export function parsePlanPrefill(sp: Record<string, string | string[] | undefined>): PlanPrefill {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const type = one("type");
  const guests = one("guests") as GuestRange | undefined;
  const media = one("media") as MediaPackage | undefined;
  return {
    ...(type && type.length <= 40 ? { eventType: type } : {}),
    ...(guests && GUESTS.includes(guests) ? { guestRange: guests } : {}),
    ...(media && MEDIA.includes(media) ? { mediaPackage: media } : {}),
    ...(one("catering") === "1" ? { catering: true } : {}),
  };
}
