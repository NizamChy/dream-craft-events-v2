import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import type { EventCategory, GuestRange, MediaPackage, OrderStatus, PaymentStatus, RequestStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../../middlewares/auth.js";
import { EVENT_TYPES, PRICING, estimateCost } from "../custom-events/pricing.js";
import {
  AFFIRM, BOOKING_CODE, BYE, EVENT_WORDS, GREETING, HELP, MY_BOOKING, MY_ORDER, MY_REQUEST, MY_WORDS, QUOTE_WORDS, STATUS_WORDS, THANKS,
  type FaqKey, type Lang, type TimeRange,
  banglishHits, detectLang, findCatering, findCategory, findCity, findCustomEventType, findFaq, findGuests, findMaxPrice, findMedia,
  findTimeRange, guestRangeFor, has, normalize, titleScore, wantsCheap,
} from "./nlu.js";

/**
 * Demo-mode chatbot: no external AI service. Intent rules (nlu.ts) decide
 * what the visitor wants and every answer about events, prices or bookings
 * comes from the real database, so the bot never invents facts.
 */

// ---------------------------------------------------------------- contract

export const contextSchema = z
  .object({
    lang: z.enum(["en", "bn", "banglish"]).optional(),
    awaiting: z.enum(["guests"]).optional(),
    quote: z
      .object({
        eventType: z.string().max(40),
        guests: z.number().int().min(1).max(100_000).optional(),
        media: z.enum(["NONE", "PHOTOGRAPHY", "VIDEOGRAPHY", "PHOTO_AND_VIDEO"]).optional(),
        catering: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();
export type ChatContext = z.infer<typeof contextSchema>;
type QuoteDraft = NonNullable<ChatContext["quote"]>;

export interface ChatEventCard {
  slug: string;
  title: string;
  image: string;
  category: EventCategory;
  venue: string;
  city: string;
  startsAt: string;
  standardPriceCents: number;
  vipPriceCents: number;
  seatsLeft: number;
}

export interface ChatItem {
  title: string;
  subtitle: string;
  status: string;
  tone: "success" | "warning" | "danger" | "neutral" | "info";
  href: string;
}

export interface ChatQuote {
  eventType: string;
  guestRange: GuestRange;
  lines: { label: string; amountCents: number }[];
  totalCents: number;
  href: string;
}

export interface ChatReply {
  text: string;
  events?: ChatEventCard[];
  items?: ChatItem[];
  quote?: ChatQuote;
  actions?: { label: string; href: string }[];
  suggestions?: string[];
  context: ChatContext;
}

// ---------------------------------------------------------------- helpers

/** Picks the reply in the visitor's language. */
const L = (lang: Lang, en: string, bn: string, banglish: string) => (lang === "bn" ? bn : lang === "banglish" ? banglish : en);

const TZ = "Asia/Dhaka";
const takaFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const takaFmtBn = new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 0 });
const money = (cents: number, lang: Lang) => `৳${(lang === "bn" ? takaFmtBn : takaFmt).format(cents / 100)}`;
const num = (n: number, lang: Lang) => (lang === "bn" ? takaFmtBn : takaFmt).format(n);
const day = (d: Date, lang: Lang) =>
  d.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const dateTime = (d: Date, lang: Lang) =>
  `${day(d, lang)}, ${d.toLocaleTimeString(lang === "bn" ? "bn-BD" : "en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" })}`;

const CATEGORY_NAMES: Record<EventCategory, [string, string, string]> = {
  TECHNOLOGY: ["tech", "টেক", "tech"],
  BUSINESS: ["business", "বিজনেস", "business"],
  MUSIC: ["music", "মিউজিক", "music"],
  ARTS: ["arts & culture", "শিল্প-সংস্কৃতি", "art & culture"],
  HEALTH: ["health & fitness", "ফিটনেস", "fitness"],
  FOOD: ["food", "খাবারের", "food"],
  EDUCATION: ["education", "শিক্ষামূলক", "education"],
  SPORTS: ["sports", "খেলাধুলার", "sports"],
  ENTERTAINMENT: ["entertainment", "বিনোদনমূলক", "entertainment"],
  OTHER: ["other", "অন্যান্য", "other"],
};
const catName = (c: EventCategory, lang: Lang) => L(lang, ...CATEGORY_NAMES[c]);

const EVENT_TYPE_NAMES: Record<string, [string, string, string]> = {
  Wedding: ["wedding", "বিয়ে", "biye"],
  Birthday: ["birthday party", "জন্মদিন", "birthday party"],
  Anniversary: ["anniversary", "বিবাহবার্ষিকী", "anniversary"],
  "Corporate Event": ["corporate event", "কর্পোরেট ইভেন্ট", "corporate event"],
  Concert: ["private concert", "কনসার্ট", "private concert"],
  Other: ["event", "অনুষ্ঠান", "event"],
};
const typeName = (t: string, lang: Lang) => L(lang, ...(EVENT_TYPE_NAMES[t] ?? EVENT_TYPE_NAMES.Other!));

function timeLabel(range: TimeRange, lang: Lang) {
  const monthName = (m: number, l: string) => new Date(2000, m, 1).toLocaleDateString(l, { month: "long" });
  switch (range.key) {
    case "today": return L(lang, "today", "আজ", "aaj");
    case "tomorrow": return L(lang, "tomorrow", "আগামীকাল", "kal");
    case "weekend": return L(lang, "this weekend", "এই সপ্তাহান্তে", "ei weekend-e");
    case "week": return L(lang, "this week", "এই সপ্তাহে", "ei shoptahe");
    case "month": return L(lang, "this month", "এই মাসে", "ei mashe");
    case "nextMonth": return L(lang, "next month", "আগামী মাসে", "agami mashe");
    case "monthName": return L(lang, `in ${monthName(range.month!, "en-US")}`, `${monthName(range.month!, "bn-BD")} মাসে`, `${monthName(range.month!, "en-US")} mashe`);
  }
}

const SUGGEST = {
  start: (lang: Lang) => [
    L(lang, "What's on this month?", "এই মাসে কী ইভেন্ট আছে?", "Ei mashe ki event ache?"),
    L(lang, "Wedding for 300 guests — cost?", "৩০০ জনের বিয়েতে কত খরচ?", "300 joner biye, koto porbe?"),
    L(lang, "Show my tickets", "আমার টিকেট দেখাও", "Amar ticket dekhao"),
    L(lang, "Refund policy", "রিফান্ড পলিসি কী?", "Refund policy ki?"),
  ],
};

function cardOf(e: { slug: string; title: string; image: string; category: EventCategory; venue: string; city: string; startsAt: Date; standardPriceCents: number; vipPriceCents: number; totalSeats: number; seatsSold: number }): ChatEventCard {
  return {
    slug: e.slug, title: e.title, image: e.image, category: e.category, venue: e.venue, city: e.city,
    startsAt: e.startsAt.toISOString(), standardPriceCents: e.standardPriceCents, vipPriceCents: e.vipPriceCents,
    seatsLeft: Math.max(0, e.totalSeats - e.seatsSold),
  };
}

const eventCardSelect = {
  slug: true, title: true, image: true, category: true, venue: true, city: true, startsAt: true,
  standardPriceCents: true, vipPriceCents: true, totalSeats: true, seatsSold: true,
} as const;

// Titles are matched against every message; keep a short-lived cache.
let titleCache: { at: number; items: { id: string; title: string }[] } | null = null;
async function eventTitles() {
  if (titleCache && Date.now() - titleCache.at < 60_000) return titleCache.items;
  const items = await prisma.event.findMany({ where: { isPublished: true }, select: { id: true, title: true }, orderBy: { startsAt: "desc" }, take: 500 });
  titleCache = { at: Date.now(), items };
  return items;
}
export const clearChatCache = () => (titleCache = null);

async function matchEvent(text: string) {
  const scored = (await eventTitles()).map((e) => ({ ...e, score: titleScore(text, e.title) })).sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 0.5) return null;
  // Ambiguous ("expo" hits two titles equally) → let the search handle it.
  if (scored[1] && scored[1].score === best.score && best.score < 1) return null;
  return best;
}

// ---------------------------------------------------------------- intents

async function eventDetail(id: string, lang: Lang): Promise<ChatReply> {
  const e = await prisma.event.findUniqueOrThrow({ where: { id }, select: { ...eventCardSelect, id: true } });
  const card = cardOf(e);
  const past = e.startsAt < new Date();
  const soldOut = card.seatsLeft === 0;
  let text: string;
  if (past) {
    text = L(lang,
      `**${e.title}** already took place on ${day(e.startsAt, lang)}. Here are a few upcoming events you might like instead.`,
      `**${e.title}** ইভেন্টটি ${day(e.startsAt, lang)} তারিখে শেষ হয়ে গেছে। নিচে সামনের কিছু ইভেন্ট দেখুন।`,
      `**${e.title}** ${day(e.startsAt, lang)} e shesh hoye geche. Samner kichu event dekhun:`);
    const soon = { isPublished: true, startsAt: { gte: new Date() } };
    let upcoming = await prisma.event.findMany({ where: { ...soon, category: e.category }, select: eventCardSelect, orderBy: { startsAt: "asc" }, take: 3 });
    if (!upcoming.length) upcoming = await prisma.event.findMany({ where: soon, select: eventCardSelect, orderBy: { startsAt: "asc" }, take: 3 });
    return { text, events: upcoming.map(cardOf), context: { lang }, suggestions: SUGGEST.start(lang).slice(0, 2) };
  }
  const prices = `${L(lang, "Standard", "স্ট্যান্ডার্ড", "Standard")} ${money(e.standardPriceCents, lang)} · VIP ${money(e.vipPriceCents, lang)}`;
  const seats = soldOut
    ? L(lang, "It is **sold out**.", "টিকেট **শেষ** হয়ে গেছে।", "Ticket **sold out** hoye geche.")
    : card.seatsLeft <= 20
      ? L(lang, `Only **${card.seatsLeft} seats** left — book soon!`, `মাত্র **${num(card.seatsLeft, lang)}টি সিট** বাকি, তাড়াতাড়ি বুক করুন!`, `Matro **${card.seatsLeft} ta seat** baki, taratari book korun!`)
      : L(lang, `${num(card.seatsLeft, lang)} seats available.`, `${num(card.seatsLeft, lang)}টি সিট খালি আছে।`, `${card.seatsLeft} ta seat khali ache.`);
  text = L(lang,
    `**${e.title}** is on ${dateTime(e.startsAt, lang)} at ${e.venue}, ${e.city}.\nTickets: ${prices}. ${seats}`,
    `**${e.title}** হবে ${dateTime(e.startsAt, lang)}, ${e.venue}, ${e.city}-এ।\nটিকেট: ${prices}। ${seats}`,
    `**${e.title}** hobe ${dateTime(e.startsAt, lang)}, ${e.venue}, ${e.city}-e.\nTicket: ${prices}. ${seats}`);
  return {
    text,
    events: [card],
    actions: soldOut ? [] : [{ label: L(lang, "Book tickets", "টিকেট বুক করুন", "Ticket book korun"), href: `/events/${e.slug}` }],
    suggestions: [
      L(lang, "VIP vs Standard?", "VIP আর Standard-এর পার্থক্য?", "VIP r Standard er parthokko ki?"),
      L(lang, "How do I pay?", "পেমেন্ট কীভাবে করব?", "Payment kivabe korbo?"),
      L(lang, `More ${catName(e.category, "en")} events`, `আরও ${catName(e.category, "bn")} ইভেন্ট`, `Aro ${catName(e.category, "banglish")} event`),
    ],
    context: { lang },
  };
}

async function searchEvents(text: string, lang: Lang): Promise<ChatReply> {
  const now = new Date();
  const category = findCategory(text);
  const city = findCity(text);
  const range = findTimeRange(text, now);
  const maxPrice = findMaxPrice(text);
  const cheap = wantsCheap(text) || maxPrice !== undefined;

  const where: Prisma.EventWhereInput = {
    isPublished: true,
    startsAt: range ? { gte: range.from < now ? now : range.from, lt: range.to } : { gte: now },
    ...(category ? { category } : {}),
    ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
    ...(maxPrice ? { standardPriceCents: { lte: maxPrice * 100 } } : {}),
  };
  const [events, total] = await prisma.$transaction([
    prisma.event.findMany({ where, select: eventCardSelect, orderBy: cheap ? { standardPriceCents: "asc" } : { startsAt: "asc" }, take: 4 }),
    prisma.event.count({ where }),
  ]);

  const parts: string[] = [];
  if (category) parts.push(catName(category, lang));
  const filterText = L(lang,
    [parts[0] ? `${parts[0]} ${total === 1 ? "event" : "events"}` : total === 1 ? "event" : "events", city && `in ${city}`, range && timeLabel(range, lang), maxPrice && `under ৳${takaFmt.format(maxPrice)}`].filter(Boolean).join(" "),
    [city && `${city}-এ`, range && timeLabel(range, lang), maxPrice && `${money(maxPrice * 100, lang)}-এর মধ্যে`, parts[0] ? `${parts[0]} ইভেন্ট` : "ইভেন্ট"].filter(Boolean).join(" "),
    [city && `${city}-e`, range && timeLabel(range, lang), maxPrice && `৳${takaFmt.format(maxPrice)} er moddhe`, parts[0] ? `${parts[0]} event` : "event"].filter(Boolean).join(" "),
  );

  const listParams = new URLSearchParams();
  if (category) listParams.set("category", category);
  if (city) listParams.set("search", city);
  if (cheap) listParams.set("sort", "price-asc");
  const listHref = `/events${listParams.size ? `?${listParams}` : ""}`;

  if (!events.length) {
    const fallback = await prisma.event.findMany({ where: { isPublished: true, startsAt: { gte: now } }, select: eventCardSelect, orderBy: { startsAt: "asc" }, take: 3 });
    return {
      text: L(lang,
        `I couldn't find any ${filterText} right now. Here are the next events coming up:`,
        `দুঃখিত, এই মুহূর্তে ${filterText} পাইনি। সামনের কয়েকটি ইভেন্ট দেখুন:`,
        `Sorry, ekhon ${filterText} pailam na. Samner kichu event dekhun:`),
      events: fallback.map(cardOf),
      actions: [{ label: L(lang, "Browse all events", "সব ইভেন্ট দেখুন", "Shob event dekhun"), href: "/events" }],
      suggestions: [L(lang, "Events this weekend", "এই সপ্তাহান্তে কী আছে?", "Ei weekend e ki ache?"), L(lang, "Cheapest events", "কম দামের ইভেন্ট", "Kom dame event")],
      context: { lang },
    };
  }

  const more = total > events.length;
  return {
    text: L(lang,
      `I found **${total}** ${filterText}${more ? `. Here are the ${cheap ? "cheapest" : "next"} ${events.length}` : ""}:`,
      `${filterText} পেয়েছি মোট **${num(total, lang)}টি**${more ? `। ${cheap ? "সবচেয়ে কম দামের" : "সামনের"} ${num(events.length, lang)}টি দেখাচ্ছি` : ""}:`,
      `${filterText} pelam mot **${total} ta**${more ? `. ${cheap ? "Shobcheye kom damer" : "Samner"} ${events.length} ta dekhacchi` : ""}:`),
    events: events.map(cardOf),
    actions: more ? [{ label: L(lang, `See all ${total}`, `সবগুলো দেখুন (${num(total, lang)})`, `Shobgulo dekhun (${total})`), href: listHref }] : [],
    suggestions: [
      cheap ? L(lang, "Events this weekend", "এই সপ্তাহান্তে কী আছে?", "Ei weekend e ki ache?") : L(lang, "Show cheaper ones", "কম দামেরগুলো দেখাও", "Kom damer gulo dekhao"),
      L(lang, "Music events in Dhaka", "ঢাকায় কনসার্ট আছে?", "Dhakay concert ache?"),
      L(lang, "How do I book?", "কীভাবে বুক করব?", "Kivabe book korbo?"),
    ],
    context: { lang },
  };
}

function quoteReply(draft: QuoteDraft, lang: Lang): ChatReply {
  const name = typeName(draft.eventType, lang);
  if (!draft.guests) {
    return {
      text: L(lang,
        `Happy to help plan your ${name}! About how many guests are you expecting?`,
        `আপনার ${name} আয়োজনে সাহায্য করতে পারলে খুশি হব! আনুমানিক কতজন অতিথি থাকবেন?`,
        `Apnar ${name} ayojon-e help korte parle khushi hobo! Mot koto jon guest hobe?`),
      suggestions: [100, 250, 500, 1000].map((n) => L(lang, `${n} guests`, `${num(n, lang)} জন`, `${n} jon`)),
      context: { lang, quote: draft, awaiting: "guests" },
    };
  }
  const range = guestRangeFor(draft.guests);
  if (!range) {
    return {
      text: L(lang,
        `For ${num(draft.guests, lang)} guests we build a custom package — our online packages go up to 1,000 guests. Send us a message or call +880 1700-000000 and a planner will prepare a quote within 2 working days.`,
        `${num(draft.guests, lang)} জন অতিথির জন্য আমরা আলাদা প্যাকেজ তৈরি করি — অনলাইন প্যাকেজ সর্বোচ্চ ১,০০০ জন পর্যন্ত। আমাদের মেসেজ দিন বা +880 1700-000000 নম্বরে কল করুন, ২ কর্মদিবসের মধ্যে প্ল্যানার কোট দেবেন।`,
        `${draft.guests} jon guest er jonno amra alada package banai — online package max 1,000 jon porjonto. Amader message din ba +880 1700-000000 e call korun, 2 working day er moddhe planner quote diben.`),
      actions: [{ label: L(lang, "Contact a planner", "প্ল্যানারের সাথে যোগাযোগ", "Planner er sathe jogajog"), href: "/contact" }],
      suggestions: [L(lang, "Make it 1000 guests", "১০০০ জন ধরো", "1000 jon dhoro")],
      context: { lang, quote: { ...draft, guests: undefined } },
    };
  }

  const media: MediaPackage = draft.media ?? "NONE";
  const catering = draft.catering ?? false;
  const MEDIA_NAMES: Record<MediaPackage, [string, string, string]> = {
    NONE: ["", "", ""],
    PHOTOGRAPHY: ["Photography", "ফটোগ্রাফি", "Photography"],
    VIDEOGRAPHY: ["Videography", "ভিডিওগ্রাফি", "Videography"],
    PHOTO_AND_VIDEO: ["Photo + video", "ছবি + ভিডিও", "Photo + video"],
  };
  const cap = { UP_TO_250: 250, UP_TO_500: 500, UP_TO_1000: 1000 }[range];
  const lines = [
    { label: L(lang, `Venue, decor & planning (up to ${num(cap, lang)} guests)`, `ভেন্যু, ডেকোর ও পরিকল্পনা (সর্বোচ্চ ${num(cap, lang)} জন)`, `Venue, decor & planning (max ${cap} jon)`), amountCents: PRICING.guestRange[range] },
    ...(media !== "NONE" ? [{ label: L(lang, ...MEDIA_NAMES[media]), amountCents: PRICING.mediaPackage[media] }] : []),
    ...(catering ? [{ label: L(lang, "Catering", "ক্যাটারিং", "Catering"), amountCents: PRICING.catering }] : []),
  ];
  const total = estimateCost(range, media, catering);
  const type = (EVENT_TYPES as readonly string[]).includes(draft.eventType) ? draft.eventType : "Other";
  const href = `/plan-your-event?${new URLSearchParams({ type, guests: range, media, catering: catering ? "1" : "0" })}`;

  const suggestions: string[] = [];
  if (media === "NONE") suggestions.push(L(lang, "Add photo + video", "ছবি + ভিডিও যোগ করো", "Photo + video add koro"));
  else suggestions.push(L(lang, "Remove photo/video", "ছবি/ভিডিও বাদ দাও", "Photo/video bad dao"));
  suggestions.push(catering ? L(lang, "Without catering", "ক্যাটারিং ছাড়া", "Catering chara") : L(lang, "Add catering", "ক্যাটারিং যোগ করো", "Catering add koro"));
  if (range !== "UP_TO_1000") suggestions.push(L(lang, "What about 1000 guests?", "১০০০ জন হলে?", "1000 jon hole?"));

  return {
    text: L(lang,
      `Here's an estimate for a ${name} with ${num(draft.guests, lang)} guests. A planner confirms the final quote after a short call.`,
      `${num(draft.guests, lang)} জন অতিথির ${name} — আনুমানিক খরচ নিচে দিলাম। একটি ছোট কলের পর প্ল্যানার চূড়ান্ত কোট নিশ্চিত করবেন।`,
      `${draft.guests} joner ${name} — estimate niche dilam. Choto ekta call er por planner final quote confirm korben.`),
    quote: { eventType: type, guestRange: range, lines, totalCents: total, href },
    actions: [{ label: L(lang, "Send this request", "এই রিকোয়েস্ট পাঠান", "Ei request pathan"), href }],
    suggestions,
    context: { lang, quote: { ...draft, media, catering } },
  };
}

const PAY_LABEL: Record<PaymentStatus, [string, string, string]> = {
  PENDING: ["Awaiting payment", "পেমেন্ট বাকি", "Payment baki"],
  PAID: ["Paid", "পরিশোধিত", "Paid"],
  FAILED: ["Payment failed", "পেমেন্ট ব্যর্থ", "Payment failed"],
  CANCELLED: ["Cancelled", "বাতিল", "Cancelled"],
};
const PAY_TONE: Record<PaymentStatus, ChatItem["tone"]> = { PENDING: "warning", PAID: "success", FAILED: "danger", CANCELLED: "neutral" };
const ORDER_LABEL: Record<OrderStatus, [string, string, string]> = {
  PENDING: ["Pending", "অপেক্ষমাণ", "Pending"],
  PROCESSING: ["Processing", "প্রসেসিং", "Processing"],
  SHIPPED: ["Shipped", "পাঠানো হয়েছে", "Shipped"],
  DELIVERED: ["Delivered", "ডেলিভারি সম্পন্ন", "Delivered"],
  CANCELLED: ["Cancelled", "বাতিল", "Cancelled"],
};
const ORDER_TONE: Record<OrderStatus, ChatItem["tone"]> = { PENDING: "warning", PROCESSING: "info", SHIPPED: "info", DELIVERED: "success", CANCELLED: "neutral" };
const REQ_LABEL: Record<RequestStatus, [string, string, string]> = {
  PENDING: ["Under review", "পর্যালোচনায়", "Review hocche"],
  APPROVED: ["Approved", "অনুমোদিত", "Approved"],
  REJECTED: ["Declined", "বাতিল", "Declined"],
};
const REQ_TONE: Record<RequestStatus, ChatItem["tone"]> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };

function loginRequired(lang: Lang, next: string): ChatReply {
  return {
    text: L(lang,
      "Please sign in first so I can look up your account. You can use the demo login buttons on the sign-in page.",
      "আপনার তথ্য দেখতে আগে সাইন ইন করুন। সাইন ইন পেজে ডেমো লগইন বাটনও আছে।",
      "Apnar info dekhte age sign in korun. Sign in page-e demo login button o ache."),
    actions: [{ label: L(lang, "Sign in", "সাইন ইন", "Sign in"), href: `/login?redirect=${encodeURIComponent(next)}` }],
    context: { lang },
  };
}

type MyKind = "bookings" | "orders" | "requests";

async function myStuff(kind: MyKind, user: AuthUser | undefined, lang: Lang): Promise<ChatReply> {
  const pages: Record<MyKind, string> = { bookings: "/dashboard/my/bookings", orders: "/dashboard/my/orders", requests: "/dashboard/my/custom-events" };
  if (!user) return loginRequired(lang, pages[kind]);
  const first = user.name.split(" ")[0];
  let items: ChatItem[] = [];
  let total = 0;

  if (kind === "bookings") {
    const where = { userId: user.id };
    const [rows, count] = await prisma.$transaction([
      prisma.booking.findMany({ where, include: { event: { select: { title: true, startsAt: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.booking.count({ where }),
    ]);
    total = count;
    items = rows.map((b) => ({
      title: b.event.title,
      subtitle: `${b.code} · ${b.quantity} × ${b.tier === "VIP" ? "VIP" : "Standard"} · ${day(b.event.startsAt, lang)}`,
      status: L(lang, ...PAY_LABEL[b.status]),
      tone: PAY_TONE[b.status],
      href: b.status === "PENDING" || b.status === "FAILED" ? `/checkout/booking/${b.id}` : `/dashboard/my/bookings/${b.id}`,
    }));
  } else if (kind === "orders") {
    const where = { userId: user.id };
    const [rows, count] = await prisma.$transaction([
      prisma.order.findMany({ where, include: { _count: { select: { items: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.order.count({ where }),
    ]);
    total = count;
    items = rows.map((o) => ({
      title: o.code,
      subtitle: `${o._count.items} ${L(lang, o._count.items === 1 ? "item" : "items", "টি পণ্য", "ta item")} · ${money(o.totalCents, lang)} · ${day(o.createdAt, lang)}`,
      status: o.paymentStatus === "PAID" || o.status === "CANCELLED" ? L(lang, ...ORDER_LABEL[o.status]) : L(lang, ...PAY_LABEL[o.paymentStatus]),
      tone: o.paymentStatus === "PAID" || o.status === "CANCELLED" ? ORDER_TONE[o.status] : PAY_TONE[o.paymentStatus],
      href: `/checkout/order/${o.id}`,
    }));
  } else {
    const where = { userId: user.id };
    const [rows, count] = await prisma.$transaction([
      prisma.customEventRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.customEventRequest.count({ where }),
    ]);
    total = count;
    items = rows.map((r) => ({
      title: `${r.eventType} · ${r.location}`,
      subtitle: `${day(r.eventDate, lang)} · ${L(lang, "est.", "আনুমানিক", "est.")} ${money(r.estimatedCostCents, lang)}`,
      status: L(lang, ...REQ_LABEL[r.status]),
      tone: REQ_TONE[r.status],
      href: pages.requests,
    }));
  }

  const what: Record<MyKind, [string, string, string]> = {
    bookings: ["ticket bookings", "টিকেট বুকিং", "ticket booking"],
    orders: ["shop orders", "শপ অর্ডার", "shop order"],
    requests: ["custom event requests", "কাস্টম ইভেন্ট রিকোয়েস্ট", "custom event request"],
  };
  if (!total) {
    const next: Record<MyKind, ChatReply["actions"]> = {
      bookings: [{ label: L(lang, "Browse events", "ইভেন্ট দেখুন", "Event dekhun"), href: "/events" }],
      orders: [{ label: L(lang, "Visit the shop", "শপে যান", "Shop-e jan"), href: "/shop" }],
      requests: [{ label: L(lang, "Plan an event", "ইভেন্ট প্ল্যান করুন", "Event plan korun"), href: "/plan-your-event" }],
    };
    return {
      text: L(lang, `${first}, you don't have any ${what[kind][0]} yet.`, `${first}, আপনার এখনও কোনো ${what[kind][1]} নেই।`, `${first}, apnar ekhono kono ${what[kind][2]} nei.`),
      actions: next[kind],
      context: { lang },
    };
  }
  return {
    text: L(lang,
      `${first}, you have **${total}** ${what[kind][0]}${total > items.length ? `. The latest ${items.length}` : ""}:`,
      `${first}, আপনার মোট **${num(total, lang)}টি** ${what[kind][1]} আছে${total > items.length ? `। সর্বশেষ ${num(items.length, lang)}টি` : ""}:`,
      `${first}, apnar mot **${total} ta** ${what[kind][2]} ache${total > items.length ? `. Latest ${items.length} ta` : ""}:`),
    items,
    actions: [{ label: L(lang, "Open in dashboard", "ড্যাশবোর্ডে দেখুন", "Dashboard-e dekhun"), href: pages[kind] }],
    suggestions: kind === "bookings"
      ? [L(lang, "How do I print my ticket?", "টিকেট প্রিন্ট করব কীভাবে?", "Ticket print korbo kivabe?"), L(lang, "Refund policy", "রিফান্ড পলিসি কী?", "Refund policy ki?")]
      : [L(lang, "Show my tickets", "আমার টিকেট দেখাও", "Amar ticket dekhao")],
    context: { lang },
  };
}

async function lookupCode(code: string, user: AuthUser | undefined, lang: Lang): Promise<ChatReply> {
  const upper = code.toUpperCase();
  if (!user) return loginRequired(lang, upper.startsWith("ORD") ? "/dashboard/my/orders" : "/dashboard/my/bookings");
  const notFound: ChatReply = {
    text: L(lang,
      `I couldn't find **${upper}** on your account. Please check the code — it's printed on your ticket and in the confirmation.`,
      `আপনার অ্যাকাউন্টে **${upper}** খুঁজে পাইনি। কোডটি আবার দেখুন — এটি টিকেট ও কনফার্মেশনে লেখা থাকে।`,
      `Apnar account-e **${upper}** khuje pailam na. Code ta abar check korun — eta ticket ar confirmation-e lekha thake.`),
    suggestions: [L(lang, "Show my tickets", "আমার টিকেট দেখাও", "Amar ticket dekhao")],
    context: { lang },
  };
  if (upper.startsWith("TKT")) {
    const b = await prisma.booking.findFirst({ where: { code: upper, userId: user.id }, include: { event: { select: { title: true, startsAt: true, venue: true } } } });
    if (!b) return notFound;
    return {
      text: L(lang, `Here's booking **${b.code}**:`, `বুকিং **${b.code}**-এর তথ্য:`, `Booking **${b.code}** er info:`),
      items: [{
        title: b.event.title,
        subtitle: `${b.quantity} × ${b.tier === "VIP" ? "VIP" : "Standard"} · ${money(b.totalCents, lang)} · ${dateTime(b.event.startsAt, lang)}`,
        status: L(lang, ...PAY_LABEL[b.status]), tone: PAY_TONE[b.status],
        href: b.status === "PENDING" || b.status === "FAILED" ? `/checkout/booking/${b.id}` : `/dashboard/my/bookings/${b.id}`,
      }],
      context: { lang },
    };
  }
  const o = await prisma.order.findFirst({ where: { code: upper, userId: user.id }, include: { _count: { select: { items: true } } } });
  if (!o) return notFound;
  const paid = o.paymentStatus === "PAID" || o.status === "CANCELLED";
  return {
    text: L(lang, `Here's order **${o.code}**:`, `অর্ডার **${o.code}**-এর তথ্য:`, `Order **${o.code}** er info:`),
    items: [{
      title: o.code,
      subtitle: `${o._count.items} ${L(lang, "items", "টি পণ্য", "ta item")} · ${money(o.totalCents, lang)} · ${day(o.createdAt, lang)}`,
      status: paid ? L(lang, ...ORDER_LABEL[o.status]) : L(lang, ...PAY_LABEL[o.paymentStatus]),
      tone: paid ? ORDER_TONE[o.status] : PAY_TONE[o.paymentStatus],
      href: `/checkout/order/${o.id}`,
    }],
    context: { lang },
  };
}

function faq(key: FaqKey, lang: Lang, user: AuthUser | undefined): ChatReply {
  const c = { lang };
  switch (key) {
    case "refund":
      return {
        text: L(lang,
          "Tickets are non-refundable unless the organizer **cancels or reschedules** the event — then you get a full refund to the original payment method within 7–10 working days. Unpaid bookings can be cancelled anytime from your dashboard.",
          "অর্গানাইজার ইভেন্ট **বাতিল বা পিছিয়ে দিলে** পুরো টাকা ৭–১০ কর্মদিবসের মধ্যে একই পেমেন্ট মাধ্যমে ফেরত দেওয়া হয়। অন্যথায় টিকেট রিফান্ডযোগ্য নয়। পেমেন্ট না করা বুকিং ড্যাশবোর্ড থেকে যেকোনো সময় বাতিল করা যায়।",
          "Organizer event **cancel ba reschedule** korle 7–10 working day er moddhe puro taka ferot pabe, je method-e pay korechen sekhane. Na hole ticket refundable na. Payment na kora booking dashboard theke jekono shomoy cancel kora jay."),
        actions: [{ label: L(lang, "Contact support", "সাপোর্টে যোগাযোগ", "Support-e jogajog"), href: "/contact" }],
        context: c,
      };
    case "cancel":
      return {
        text: L(lang,
          "You can cancel a booking that is **not paid yet** from *My bookings*. Paid tickets can't be cancelled online — contact support and we'll help (refunds apply only if the event is cancelled or rescheduled).",
          "যে বুকিংয়ের **পেমেন্ট এখনও হয়নি** সেটি *My bookings* থেকে বাতিল করতে পারবেন। পেমেন্ট করা টিকেট অনলাইনে বাতিল হয় না — সাপোর্টে যোগাযোগ করুন (ইভেন্ট বাতিল বা পিছালে রিফান্ড পাবেন)।",
          "Jei booking er **payment ekhono hoy nai** seta *My bookings* theke cancel korte parben. Paid ticket online-e cancel hoy na — support-e jogajog korun (event cancel/reschedule hole refund paben)."),
        actions: [
          { label: L(lang, "My bookings", "আমার বুকিং", "Amar booking"), href: "/dashboard/my/bookings" },
          { label: L(lang, "Contact support", "সাপোর্টে যোগাযোগ", "Support-e jogajog"), href: "/contact" },
        ],
        context: c,
      };
    case "payment":
      return {
        text: L(lang,
          "Checkout is in **demo mode** right now: press *Pay* to complete a test payment, or *Simulate decline* to see a failed one — no real money is charged. When we go live you'll be able to pay with bKash, Nagad, Rocket or any Visa/Mastercard.",
          "পেমেন্ট এখন **ডেমো মোডে** আছে: *Pay* চাপলে টেস্ট পেমেন্ট হবে, *Simulate decline* চাপলে ব্যর্থ পেমেন্ট দেখাবে — কোনো আসল টাকা কাটা হয় না। লাইভ হলে বিকাশ, নগদ, রকেট বা ভিসা/মাস্টারকার্ড দিয়ে পেমেন্ট করা যাবে।",
          "Payment ekhon **demo mode-e** ache: *Pay* chaple test payment hobe, *Simulate decline* chaple failed payment dekhabe — kono ashol taka kata hoy na. Live hole bKash, Nagad, Rocket ba Visa/Mastercard diye pay kora jabe."),
        suggestions: [L(lang, "How do I book?", "কীভাবে বুক করব?", "Kivabe book korbo?")],
        context: c,
      };
    case "howToBook":
      return {
        text: L(lang,
          "Booking takes a minute:\n1. Open an event and choose **Standard** or **VIP**.\n2. Pick how many tickets (up to 10) and press *Book*.\n3. Pay on the checkout page.\n4. Your e-ticket appears in *My bookings* — print it or save it as PDF.",
          "বুকিং করতে এক মিনিট লাগে:\n১. ইভেন্ট খুলে **Standard** বা **VIP** বাছুন।\n২. কয়টি টিকেট (সর্বোচ্চ ১০) বেছে *Book* চাপুন।\n৩. চেকআউট পেজে পেমেন্ট করুন।\n৪. ই-টিকেট *My bookings*-এ পাবেন — প্রিন্ট বা PDF করে রাখুন।",
          "Booking korte 1 minute lage:\n1. Event khule **Standard** ba **VIP** bachun.\n2. Koyta ticket (max 10) select kore *Book* chapun.\n3. Checkout page-e payment korun.\n4. E-ticket *My bookings*-e paben — print ba PDF kore rakhun."),
        actions: [{ label: L(lang, "Browse events", "ইভেন্ট দেখুন", "Event dekhun"), href: "/events" }],
        suggestions: [L(lang, "What's on this month?", "এই মাসে কী ইভেন্ট আছে?", "Ei mashe ki event ache?")],
        context: c,
      };
    case "tiers":
      return {
        text: L(lang,
          "**Standard** — entry to all sessions plus the food court and expo area.\n**VIP** — everything in Standard, plus reserved front seating, a meet-and-greet with speakers/performers and session recordings.",
          "**Standard** — সব সেশনে প্রবেশ, সাথে ফুড কোর্ট ও এক্সপো এরিয়া।\n**VIP** — Standard-এর সবকিছু, সাথে সামনের সারিতে সংরক্ষিত আসন, স্পিকার/শিল্পীদের সাথে সাক্ষাৎ এবং সেশনের রেকর্ডিং।",
          "**Standard** — shob session-e entry, shathe food court ar expo area.\n**VIP** — Standard er shob kichu, plus shamner shari-te reserved seat, speaker/performer der sathe meet & greet, ar session recording."),
        context: c,
      };
    case "groupBooking":
      return {
        text: L(lang,
          "You can book up to **10 tickets** in one booking. For larger groups (schools, offices), contact us and we'll arrange a group rate.",
          "এক বুকিংয়ে সর্বোচ্চ **১০টি টিকেট** নেওয়া যায়। বড় গ্রুপের (স্কুল, অফিস) জন্য যোগাযোগ করুন, আমরা গ্রুপ রেট দেব।",
          "Ek booking-e max **10 ta ticket** newa jay. Boro group (school, office) er jonno jogajog korun, amra group rate dibo."),
        actions: [{ label: L(lang, "Contact us", "যোগাযোগ করুন", "Jogajog korun"), href: "/contact" }],
        context: c,
      };
    case "printTicket":
      return {
        text: L(lang,
          "Open *My bookings*, choose a **paid** booking and press *Print ticket*. You get an A4 e-ticket with your booking code — print it or choose *Save as PDF*. Show it (on paper or phone) at the entrance.",
          "*My bookings* খুলে **পেমেন্ট করা** বুকিং বাছুন, তারপর *Print ticket* চাপুন। বুকিং কোডসহ A4 ই-টিকেট পাবেন — প্রিন্ট করুন বা *Save as PDF* করুন। প্রবেশপথে কাগজে বা ফোনে দেখালেই হবে।",
          "*My bookings* khule **paid** booking select korun, tarpor *Print ticket* chapun. Booking code shoho A4 e-ticket paben — print korun ba *Save as PDF* korun. Entrance-e kagoj ba phone-e dekhale-i hobe."),
        actions: [{ label: L(lang, "My bookings", "আমার বুকিং", "Amar booking"), href: "/dashboard/my/bookings" }],
        context: c,
      };
    case "organizer":
      return {
        text: L(lang,
          "Want to sell tickets for your own event? Apply to become an **organizer** from your dashboard. An admin reviews the request, and once approved you can publish events and track bookings.",
          "নিজের ইভেন্টের টিকেট বিক্রি করতে চান? ড্যাশবোর্ড থেকে **অর্গানাইজার** হওয়ার আবেদন করুন। অ্যাডমিন যাচাই করে অনুমোদন দিলে আপনি ইভেন্ট প্রকাশ ও বুকিং দেখতে পারবেন।",
          "Nijer event er ticket bikri korte chan? Dashboard theke **organizer** howar request korun. Admin check kore approve korle apni event publish ar booking track korte parben."),
        actions: [user ? { label: L(lang, "Apply now", "আবেদন করুন", "Apply korun"), href: "/dashboard/become-organizer" } : { label: L(lang, "Create an account", "অ্যাকাউন্ট খুলুন", "Account khulun"), href: "/register" }],
        context: c,
      };
    case "shop":
      return {
        text: L(lang,
          "Our shop sells event merchandise and party supplies. Add items to the cart, check out with your address and phone, and track the order from *My orders*.",
          "আমাদের শপে ইভেন্ট মার্চেন্ডাইজ ও পার্টির জিনিস পাওয়া যায়। কার্টে যোগ করে ঠিকানা ও ফোন দিয়ে চেকআউট করুন, অর্ডার *My orders* থেকে ট্র্যাক করুন।",
          "Amader shop-e event merch ar party supplies paben. Cart-e add kore address ar phone diye checkout korun, order *My orders* theke track korun."),
        actions: [{ label: L(lang, "Visit the shop", "শপে যান", "Shop-e jan"), href: "/shop" }],
        suggestions: [L(lang, "Where is my order?", "আমার অর্ডার কোথায়?", "Amar order kothay?")],
        context: c,
      };
    case "account":
      return {
        text: user
          ? L(lang,
              "You're signed in. You can update your name, phone, photo and password from your profile.",
              "আপনি সাইন ইন করা আছেন। প্রোফাইল থেকে নাম, ফোন, ছবি ও পাসওয়ার্ড বদলাতে পারবেন।",
              "Apni sign in kora achen. Profile theke nam, phone, chobi ar password change korte parben.")
          : L(lang,
              "Creating an account is free — just your name, email and a password. To try things quickly, use the **demo login** buttons on the sign-in page.",
              "অ্যাকাউন্ট খোলা বিনামূল্যে — শুধু নাম, ইমেইল আর পাসওয়ার্ড লাগবে। দ্রুত দেখতে সাইন ইন পেজের **ডেমো লগইন** বাটন ব্যবহার করুন।",
              "Account khola free — shudhu nam, email ar password lagbe. Taratari try korte sign in page er **demo login** button use korun."),
        actions: user
          ? [{ label: L(lang, "Open profile", "প্রোফাইল", "Profile"), href: "/dashboard/profile" }]
          : [{ label: L(lang, "Sign in", "সাইন ইন", "Sign in"), href: "/login" }, { label: L(lang, "Create account", "অ্যাকাউন্ট খুলুন", "Account khulun"), href: "/register" }],
        context: c,
      };
    case "contact":
      return {
        text: L(lang,
          "📍 House 12, Road 7, Dhanmondi, Dhaka 1205\n📞 +880 1700-000000 (10am–8pm, Sat–Thu)\n✉️ hello@dreamcraft.dev\nOr send a message from the contact page — we usually reply within a day.",
          "📍 বাড়ি ১২, রোড ৭, ধানমন্ডি, ঢাকা ১২০৫\n📞 +880 1700-000000 (সকাল ১০টা–রাত ৮টা, শনি–বৃহস্পতি)\n✉️ hello@dreamcraft.dev\nঅথবা যোগাযোগ পেজ থেকে মেসেজ দিন — সাধারণত এক দিনের মধ্যে উত্তর দিই।",
          "📍 House 12, Road 7, Dhanmondi, Dhaka 1205\n📞 +880 1700-000000 (shokal 10ta–rat 8ta, Shoni–Brihoshpoti)\n✉️ hello@dreamcraft.dev\nAthoba contact page theke message din — shadharonto 1 diner moddhe reply dei."),
        actions: [{ label: L(lang, "Contact page", "যোগাযোগ পেজ", "Contact page"), href: "/contact" }],
        context: c,
      };
    case "about":
      return {
        text: L(lang,
          "I'm the Dream Craft assistant 🤖 — a demo bot. I can find events, estimate the cost of a wedding or party, show your bookings and answer common questions.",
          "আমি Dream Craft অ্যাসিস্ট্যান্ট 🤖 — একটি ডেমো বট। ইভেন্ট খুঁজে দিতে, বিয়ে বা পার্টির খরচ হিসাব করতে, আপনার বুকিং দেখাতে আর সাধারণ প্রশ্নের উত্তর দিতে পারি।",
          "Ami Dream Craft assistant 🤖 — ekta demo bot. Event khuje dite, biye ba party r khoroch hishab korte, apnar booking dekhate ar common proshner uttor dite pari."),
        suggestions: SUGGEST.start(lang),
        context: c,
      };
  }
}

function smallTalk(kind: "greet" | "thanks" | "bye" | "help", lang: Lang, user?: AuthUser): ChatReply {
  const first = user?.name.split(" ")[0];
  const hello = first ? L(lang, `Hi ${first}! 👋`, `হ্যালো ${first}! 👋`, `Hi ${first}! 👋`) : L(lang, "Hi there! 👋", "হ্যালো! 👋", "Hi! 👋");
  switch (kind) {
    case "greet":
    case "help":
      return {
        text: `${kind === "greet" ? `${hello} ` : ""}${L(lang,
          "I can help you:\n• find events by date, city, type or budget\n• estimate the cost of a wedding, birthday or corporate event\n• check your tickets, orders and requests\n• answer questions about payment, refunds and tickets",
          "আমি যা করতে পারি:\n• তারিখ, শহর, ধরন বা বাজেট দিয়ে ইভেন্ট খোঁজা\n• বিয়ে, জন্মদিন বা কর্পোরেট ইভেন্টের খরচ হিসাব\n• আপনার টিকেট, অর্ডার ও রিকোয়েস্টের অবস্থা দেখা\n• পেমেন্ট, রিফান্ড ও টিকেট নিয়ে প্রশ্নের উত্তর",
          "Ami ja korte pari:\n• date, city, type ba budget diye event khuja\n• biye, birthday ba corporate event er khoroch hishab\n• apnar ticket, order ar request er status dekha\n• payment, refund ar ticket niye proshner uttor")}`,
        suggestions: SUGGEST.start(lang),
        context: { lang },
      };
    case "thanks":
      return {
        text: L(lang, "You're welcome! Anything else I can help with?", "আপনাকেও ধন্যবাদ! আর কিছু জানতে চান?", "Apnakeo dhonnobad! Ar kichu jante chan?"),
        suggestions: SUGGEST.start(lang).slice(0, 2),
        context: { lang },
      };
    case "bye":
      return { text: L(lang, "Goodbye — enjoy your events! 🎉", "আল্লাহ হাফেজ — ভালো থাকবেন! 🎉", "Allah Hafez — bhalo thakben! 🎉"), context: { lang } };
  }
}

function fallback(lang: Lang): ChatReply {
  return {
    text: L(lang,
      "Sorry, I didn't quite get that. I'm a demo assistant, so I understand questions about events, prices, bookings and planning. Try one of these:",
      "দুঃখিত, ঠিক বুঝতে পারিনি। আমি একটি ডেমো অ্যাসিস্ট্যান্ট — ইভেন্ট, দাম, বুকিং আর প্ল্যানিং নিয়ে প্রশ্ন বুঝি। এগুলো চেষ্টা করুন:",
      "Sorry, thik bujhte parlam na. Ami ekta demo assistant — event, dam, booking ar planning niye proshno bujhi. Egulo try korun:"),
    suggestions: SUGGEST.start(lang),
    actions: [{ label: L(lang, "Talk to a human", "মানুষের সাথে কথা বলুন", "Manusher sathe kotha bolun"), href: "/contact" }],
    context: { lang },
  };
}

// ---------------------------------------------------------------- router

export async function respond(message: string, context: ChatContext, user?: AuthUser): Promise<ChatReply> {
  const reply = await route(message, context, user);
  // Templates can start with a lowercase filter ("ei mashe event pelam…").
  return { ...reply, text: reply.text.charAt(0).toUpperCase() + reply.text.slice(1) };
}

async function route(message: string, context: ChatContext, user?: AuthUser): Promise<ChatReply> {
  const text = normalize(message);
  const detected = detectLang(message);
  // A short reply like "300" or "ok" says nothing about language — keep the
  // previous one; one Banglish word is enough when we were already in Banglish.
  const lang: Lang =
    detected === "en" && context.lang && (!/[a-z]{4,}/.test(text) || (context.lang === "banglish" && banglishHits(message) > 0)) ? context.lang : detected;

  // 1. A ticket / order code.
  const code = text.match(BOOKING_CODE);
  if (code) return lookupCode(code[0], user, lang);

  // 2. Answering "how many guests?" for a quote in progress.
  if (context.quote && context.awaiting === "guests") {
    const guests = findGuests(text, true);
    if (guests) {
      return quoteReply({ ...context.quote, guests, media: findMedia(text) ?? context.quote.media, catering: findCatering(text) ?? context.quote.catering }, lang);
    }
  }

  const status = has(text, STATUS_WORDS);
  const mine = has(text, MY_WORDS) || status;
  const customType = findCustomEventType(text);

  // 3. "my tickets / my order / my request".
  if (mine) {
    if (has(text, MY_ORDER)) return myStuff("orders", user, lang);
    if (has(text, MY_REQUEST) || (customType && status && !has(text, QUOTE_WORDS))) return myStuff("requests", user, lang);
    if (has(text, MY_BOOKING) && !findFaq(text)) return myStuff("bookings", user, lang);
  }

  // 4. A specific event by name.
  const match = await matchEvent(text);
  if (match) return eventDetail(match.id, lang);

  // 5. Custom event quote — new, or adjusting the one in progress.
  const guests = findGuests(text);
  const media = findMedia(text);
  const catering = findCatering(text);
  const searching = has(text, EVENT_WORDS) && !customType;
  if (customType || (has(text, QUOTE_WORDS) && guests)) {
    const base = context.quote && (!customType || customType === context.quote.eventType) ? context.quote : { eventType: customType ?? "Other" };
    return quoteReply({ ...base, eventType: customType ?? base.eventType, guests: guests ?? base.guests, media: media ?? base.media, catering: catering ?? base.catering }, lang);
  }
  if (context.quote && !searching && (guests || media || catering !== undefined || has(text, [/\d+ (?:jon )?hole/, "what about"]))) {
    const g = guests ?? findGuests(text, true);
    return quoteReply({ ...context.quote, guests: g ?? context.quote.guests, media: media ?? context.quote.media, catering: catering ?? context.quote.catering }, lang);
  }

  // 6. Common questions ("amar ticket print korbo kivabe" lands here, then
  // a plain "amar ticket" falls through to the bookings list).
  const faqKey = findFaq(text);
  if (faqKey && !(faqKey === "account" && searching)) return faq(faqKey, lang, user);
  if (mine && has(text, MY_BOOKING)) return myStuff("bookings", user, lang);

  // 7. Event discovery.
  if (searching || findCategory(text) || findCity(text) || findTimeRange(text) || findMaxPrice(text) || wantsCheap(text) || has(text, ["ticket", "tickets", "টিকেট", "টিকিট"])) {
    return searchEvents(text, lang);
  }
  if (has(text, QUOTE_WORDS)) return quoteReply({ eventType: "Other" }, lang);

  // 8. Small talk.
  if (has(text, THANKS)) return smallTalk("thanks", lang, user);
  if (has(text, BYE)) return smallTalk("bye", lang, user);
  if (has(text, GREETING)) return smallTalk("greet", lang, user);
  if (has(text, HELP) || (has(text, AFFIRM) && text.split(" ").length <= 2)) return smallTalk("help", lang, user);

  return fallback(lang);
}
