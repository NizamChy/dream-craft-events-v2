import type { EventCategory, GuestRange, MediaPackage } from "../../generated/prisma/enums.js";

/**
 * Rule based language understanding for the demo chatbot.
 * Understands English, Bangla script and Banglish (Bangla in Latin letters).
 * Everything here is pure and synchronous so it can be unit tested.
 */

export type Lang = "en" | "bn" | "banglish";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Lowercases, converts Bangla digits, strips punctuation that never matters. */
export function normalize(input: string) {
  return input
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[?!।,;:"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BANGLISH_WORDS = [
  "ami", "amar", "amr", "apni", "apnar", "tumi", "tomar", "ache", "ase", "achhe", "nai", "nei", "koto", "kto", "kemon", "kivabe",
  "kibhabe", "kothay", "kobe", "kon", "kono", "kisu", "kichu", "chai", "cai", "lagbe", "dekhao", "dekhan", "bolo", "bolen", "korbo",
  "korte", "koro", "koren", "jabe", "hobe", "hoy", "porbe", "khoroch", "taka", "takar", "dam", "er", "ei", "mashe", "mash", "aj",
  "aaj", "kal", "biye", "biyer", "jonmodin", "jon", "lok", "khabar", "gaan", "khela", "valo", "bhalo", "dhonnobad", "thik", "achha",
  "accha", "acha", "na", "hae", "haan", "ki", "sob", "shob", "agami", "shoptah", "niche", "moddhe", "sosta", "pabo", "jaigai", "kar",
  "keno", "dorkar", "cancel", "korsi", "korechi", "pai", "dibo", "den", "din", "hole", "chara", "dao", "aro", "dhoro", "dekhun",
  "jante", "korun", "kivabe", "khuje", "pathao", "pathan",
];
const BANGLISH_SET = new Set(BANGLISH_WORDS);

export function detectLang(raw: string): Lang {
  if (/[ঀ-৿]/.test(raw)) return "bn";
  const words = normalize(raw).split(" ");
  const hits = words.filter((w) => BANGLISH_SET.has(w)).length;
  // "er"/"ki"/"na" alone are too weak; need two hits or one strong one.
  const strong = words.some((w) => BANGLISH_SET.has(w) && (w.length >= 4 || w === "ki") && !["taka", "cancel"].includes(w));
  return hits >= 2 || strong ? "banglish" : "en";
}

/** True when any of the patterns appear as words/phrases in the text. */
export function has(text: string, patterns: (string | RegExp)[]) {
  return patterns.some((p) => {
    if (p instanceof RegExp) return p.test(text);
    // Bangla script has no reliable \b, so match it as a substring.
    if (/[ঀ-৿]/.test(p)) return text.includes(p);
    return new RegExp(`(^|[^a-z0-9])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(text);
  });
}

// ---------------------------------------------------------------- entities

export const CATEGORY_WORDS: Record<EventCategory, string[]> = {
  MUSIC: ["music", "musical", "concert", "concerts", "gaan", "gan", "song", "band", "live music", "dj", "গান", "কনসার্ট", "মিউজিক", "সংগীত"],
  TECHNOLOGY: ["tech", "technology", "developer", "developers", "coding", "programming", "software", "artificial intelligence","প্রযুক্তি", "টেক", "ডেভেলপার"],
  BUSINESS: ["business", "startup", "startups", "entrepreneur", "entrepreneurship", "pitch", "biz", "babsha", "বিজনেস", "ব্যবসা", "স্টার্টআপ"],
  ARTS: ["art", "arts", "culture", "cultural", "painting", "exhibition", "shilpo", "শিল্প", "সংস্কৃতি", "আর্ট"],
  HEALTH: ["health", "fitness", "gym", "yoga", "marathon", "sastho", "shastho", "স্বাস্থ্য", "ফিটনেস"],
  FOOD: ["food", "foods", "khabar", "khawa", "khaoa", "street food", "cooking", "খাবার", "ফুড"],
  EDUCATION: ["education", "science", "learning", "workshop", "seminar", "shikkha", "বিজ্ঞান", "শিক্ষা", "ওয়ার্কশপ"],
  SPORTS: ["sport", "sports", "khela", "cricket", "football", "খেলা", "ক্রিকেট", "ফুটবল"],
  ENTERTAINMENT: ["entertainment", "movie", "movies", "film", "cinema", "fashion", "carnival", "cinema hall", "সিনেমা", "মুভি", "ফ্যাশন", "বিনোদন"],
  OTHER: [],
};

export function findCategory(text: string): EventCategory | undefined {
  for (const [cat, words] of Object.entries(CATEGORY_WORDS) as [EventCategory, string[]][]) {
    if (words.length && has(text, words)) return cat;
  }
  return undefined;
}

const CITIES: { city: string; words: string[] }[] = [
  { city: "Dhaka", words: ["dhaka", "dhakay", "dhakar", "ঢাকা", "ঢাকায়", "ঢাকার"] },
  { city: "Chattogram", words: ["chattogram", "chittagong", "ctg", "chottogram", "চট্টগ্রাম", "চট্টগ্রামে"] },
  { city: "Sylhet", words: ["sylhet", "sylhete", "সিলেট"] },
  { city: "Khulna", words: ["khulna", "খুলনা"] },
  { city: "Rajshahi", words: ["rajshahi", "রাজশাহী"] },
  { city: "Barishal", words: ["barishal", "barisal", "বরিশাল"] },
  { city: "Rangpur", words: ["rangpur", "রংপুর"] },
  { city: "Cumilla", words: ["cumilla", "comilla", "কুমিল্লা"] },
  { city: "Mymensingh", words: ["mymensingh", "ময়মনসিংহ"] },
  { city: "Cox's Bazar", words: ["cox's bazar", "coxs bazar", "cox bazar", "কক্সবাজার"] },
];

export function findCity(text: string): string | undefined {
  return CITIES.find((c) => has(text, c.words))?.city;
}

export type TimeRange = { from: Date; to: Date; key: "today" | "tomorrow" | "weekend" | "week" | "month" | "nextMonth" | "monthName"; month?: number };

const MONTHS: [number, string[]][] = [
  [0, ["january", "jan", "জানুয়ারি", "জানুয়ারী"]],
  [1, ["february", "feb", "ফেব্রুয়ারি", "ফেব্রুয়ারী"]],
  [2, ["march", "মার্চ"]],
  [3, ["april", "apr", "এপ্রিল"]],
  [4, ["may", "মে"]],
  [5, ["june", "জুন"]],
  [6, ["july", "জুলাই"]],
  [7, ["august", "aug", "আগস্ট"]],
  [8, ["september", "sept", "sep", "সেপ্টেম্বর"]],
  [9, ["october", "oct", "অক্টোবর"]],
  [10, ["november", "nov", "নভেম্বর"]],
  [11, ["december", "dec", "ডিসেম্বর"]],
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function findTimeRange(text: string, now = new Date()): TimeRange | undefined {
  const today = startOfDay(now);
  if (has(text, ["today", "tonight", "aj", "aaj", "ajke", "aajke", "আজ", "আজকে"])) return { key: "today", from: now, to: addDays(today, 1) };
  if (has(text, ["tomorrow", "kal", "kalke", "agamikal", "আগামীকাল", "কালকে"]))
    return { key: "tomorrow", from: addDays(today, 1), to: addDays(today, 2) };
  if (has(text, ["weekend", "friday", "saturday", "shukrobar", "sukrobar", "shonibar", "ছুটির দিন", "শুক্রবার", "শনিবার", "উইকেন্ড"])) {
    // Bangladesh weekend: Friday + Saturday.
    const day = today.getDay();
    if (day === 5) return { key: "weekend", from: now, to: addDays(today, 2) };
    if (day === 6) return { key: "weekend", from: now, to: addDays(today, 1) };
    const friday = addDays(today, (5 - day + 7) % 7);
    return { key: "weekend", from: friday, to: addDays(friday, 2) };
  }
  if (has(text, ["this week", "ei shoptah", "ei soptah", "ei week", "এই সপ্তাহ", "এই সপ্তাহে", /next 7 days/]))
    return { key: "week", from: now, to: addDays(today, 7) };
  if (has(text, ["next month", "agami mash", "agami mashe", "porer mash", "porer mashe", "samner mash", "samner mashe", "আগামী মাস", "আগামী মাসে", "সামনের মাসে", "পরের মাসে"])) {
    return { key: "nextMonth", from: new Date(now.getFullYear(), now.getMonth() + 1, 1), to: new Date(now.getFullYear(), now.getMonth() + 2, 1) };
  }
  if (has(text, ["this month", "ei mash", "ei mashe", "ei masher", "এই মাস", "এই মাসে"]))
    return { key: "month", from: now, to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  for (const [m, words] of MONTHS) {
    // "may" is also an English verb; only treat it as a month next to a number or "in may".
    const ws = m === 4 ? [/(^|\s)(in|of) may($|\s)/, /\d+ may/, /may \d+/, "মে মাসে"] : words;
    if (has(text, ws)) {
      const year = m < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
      const from = new Date(year, m, 1);
      return { key: "monthName", month: m, from: from < now ? now : from, to: new Date(year, m + 1, 1) };
    }
  }
  return undefined;
}

const BUDGET_UNDER = /(?:under|below|less than|within|max|niche|nicher|moddhe|kome|kom|নিচে|মধ্যে|কম)/;

/** "under 1000 taka", "1500 takar moddhe", "৳2000 er niche" → max ticket price in taka. */
export function findMaxPrice(text: string): number | undefined {
  const m =
    text.match(/(?:under|below|less than|within|max)\s*(?:৳|tk\.?|taka|bdt)?\s*(\d[\d,]*)/) ??
    text.match(/(?:৳|tk\.?\s*)?(\d[\d,]*)\s*(?:৳|takar|taka|tk|bdt|টাকার|টাকা)\s*(?:er\s*)?(\S+)?/);
  if (!m) return undefined;
  const amount = Number(m[1]!.replace(/,/g, ""));
  if (!amount) return undefined;
  if (m[0].match(/^(under|below|less than|within|max)/)) return amount;
  return m[2] && BUDGET_UNDER.test(m[2]) ? amount : undefined;
}

export const wantsCheap = (text: string) => has(text, ["cheap", "cheapest", "low price", "budget", "affordable", "sosta", "shosta", "kom dam", "kom dame", "সস্তা", "কম দাম", "কম দামে"]);

// ---------------------------------------------------------------- custom event quotes

export const CUSTOM_EVENT_WORDS: { type: string; words: string[] }[] = [
  { type: "Wedding", words: ["wedding", "biye", "biya", "biyer", "bie", "holud", "gaye holud", "reception", "walima", "akd", "aqd", "বিয়ে", "বিয়ের", "হলুদ", "বৌভাত", "walima", "বিবাহ"] },
  { type: "Birthday", words: ["birthday", "bday", "b'day", "jonmodin", "jonmodiner", "জন্মদিন", "জন্মদিনের"] },
  { type: "Anniversary", words: ["anniversary", "barshiki", "বার্ষিকী", "এনিভার্সারি"] },
  { type: "Corporate Event", words: ["corporate", "office party", "office event", "company event", "annual meeting", "agm", "কর্পোরেট", "অফিস পার্টি"] },
  { type: "Concert", words: ["private concert"] },
  { type: "Other", words: ["party", "get together", "reunion", "aqiqah", "akika", "পার্টি", "আকিকা", "পুনর্মিলনী"] },
];

export function findCustomEventType(text: string): string | undefined {
  return CUSTOM_EVENT_WORDS.find((t) => has(text, t.words))?.type;
}

const GUEST_UNITS = "(?:jon|jn|joner|guest|guests|people|persons?|lok|loker|attendees|mehman|mehoman|atithi|জন|জনের|অতিথি|লোক|গেস্ট|মেহমান)";

/** Extracts a guest head-count. With `bare`, a lone number counts too (answering "how many guests?"). */
export function findGuests(text: string, bare = false): number | undefined {
  // "1 hajar jon" / "2k guests" (a bare "5k" is more likely a budget).
  const hajar = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:hajar|hazar|হাজার|k)(?![a-z])\\s*(${GUEST_UNITS})?`));
  if (hajar && (hajar[2] || bare)) return Math.round(Number(hajar[1]) * 1000);
  const withUnit = text.match(new RegExp(`(\\d[\\d,]*)\\s*\\+?\\s*${GUEST_UNITS}`));
  if (withUnit) return Number(withUnit[1]!.replace(/,/g, ""));
  const guestFirst = text.match(/(?:guests?|people|attendees|অতিথি)\s*(?:count|number)?\s*[:=]?\s*(\d[\d,]*)/);
  if (guestFirst) return Number(guestFirst[1]!.replace(/,/g, ""));
  if (bare) {
    const lone = text.match(/(^|\s)(\d[\d,]*)\s*\+?($|\s)/);
    if (lone) return Number(lone[2]!.replace(/,/g, ""));
  }
  return undefined;
}

export function guestRangeFor(guests: number): GuestRange | null {
  if (guests <= 250) return "UP_TO_250";
  if (guests <= 500) return "UP_TO_500";
  if (guests <= 1000) return "UP_TO_1000";
  return null; // larger than any package → talk to a planner
}

const PHOTO = ["photo", "photos", "photography", "photographer", "picture", "pictures", "chobi", "chhobi", "chobi tola", "ছবি", "ফটো", "ফটোগ্রাফি", "ফটোগ্রাফার"];
const VIDEO = ["video", "videos", "videography", "videographer", "cinematography", "ভিডিও", "ভিডিওগ্রাফি"];
const NEGATE = /(no|without|remove|chara|charai|lagbe na|chai na|dorkar nai|dorkar nei|na lagbe|bad|baad|ছাড়া|লাগবে না|চাই না|বাদ)/;

/** Returns the media package the text asks for, `NONE` when explicitly declined, or undefined. */
export function findMedia(text: string): MediaPackage | undefined {
  const photo = has(text, PHOTO);
  const video = has(text, VIDEO);
  const both = has(text, ["both", "dutoi", "duitai", "duto i", "photo video", "photo and video", "photo + video", "photo o video", "দুটোই", "ছবি ও ভিডিও"]);
  if ((photo || video) && NEGATE.test(text) && !both) {
    // "video lagbe na, shudhu photo" → keep the one asked for with "only".
    const only = text.match(/(?:only|just|shudhu|sudhu|শুধু)\s*(\S+)/);
    if (only && has(only[1]!, PHOTO)) return "PHOTOGRAPHY";
    if (only && has(only[1]!, VIDEO)) return "VIDEOGRAPHY";
    return "NONE";
  }
  if (both || (photo && video)) return "PHOTO_AND_VIDEO";
  if (photo) return "PHOTOGRAPHY";
  if (video) return "VIDEOGRAPHY";
  return undefined;
}

const CATERING = ["catering", "khabar", "khawa", "khaoa", "food", "foods", "meal", "meals", "dinner", "lunch", "buffet", "khana", "খাবার", "ক্যাটারিং", "খাওয়া"];

/** true = wants catering, false = explicitly declined, undefined = not mentioned. */
export function findCatering(text: string): boolean | undefined {
  if (!has(text, CATERING)) return undefined;
  const after = new RegExp(`(${CATERING.join("|")})\\s*(?:\\S+\\s*)?${NEGATE.source}`);
  const before = /(no|without)\s+(catering|food|meals?)/;
  return after.test(text) || before.test(text) ? false : true;
}

// ---------------------------------------------------------------- intents

export const BOOKING_CODE = /\b(tkt|ord)-[a-z0-9]{8}\b/i;

export const MY_WORDS = ["my", "mine", "amar", "amr", "amader", "আমার", "আমাদের"];
export const MY_BOOKING = ["ticket", "tickets", "booking", "bookings", "tiket", "টিকেট", "টিকিট", "বুকিং"];
export const MY_ORDER = ["order", "orders", "purchase", "parcel", "delivery", "অর্ডার", "ডেলিভারি"];
export const MY_REQUEST = ["request", "requests", "custom event", "রিকোয়েস্ট", "আবেদন"];
export const STATUS_WORDS = [/(^|\s)status($|\s)/, "kothay", "kotodur", "update", "where is", "কোথায়", "স্ট্যাটাস", "অবস্থা"];

export const EVENT_WORDS = [
  "event", "events", "ivent", "program", "programme", "show", "shows", "concert", "concerts", "festival", "fest", "happening",
  "ki ache", "ki ase", "kisu ache", "upcoming", "অনুষ্ঠান", "ইভেন্ট", "প্রোগ্রাম", "উৎসব", "কি আছে", "কী আছে",
];

export const QUOTE_WORDS = [
  "plan", "planning", "arrange", "organise", "organize", "ayojon", "aayojon", "quote", "estimate", "cost", "budget", "khoroch",
  "koto porbe", "koto lagbe", "package", "decor", "decoration", "আয়োজন", "খরচ", "কত পড়বে", "কত লাগবে", "প্যাকেজ", "ডেকোরেশন",
];

export type FaqKey =
  | "refund" | "payment" | "howToBook" | "tiers" | "printTicket" | "organizer" | "contact" | "shop" | "account" | "cancel" | "about" | "groupBooking";

export const FAQ: { key: FaqKey; words: (string | RegExp)[] }[] = [
  { key: "refund", words: ["refund", "money back", "taka ferot", "ferot", "return", "ফেরত", "রিফান্ড"] },
  { key: "cancel", words: ["cancel", "cancellation", "batil", "বাতিল", "ক্যানসেল"] },
  { key: "payment", words: ["payment", "pay", "bkash", "nagad", "rocket", "card", "visa", "mastercard", "sslcommerz", "cash", "পেমেন্ট", "বিকাশ", "নগদ", "কার্ড", "টাকা দিব", "taka dibo", "kivabe pay", "kibhabe pay"] },
  { key: "printTicket", words: ["print", "download", "pdf", "e-ticket", "eticket", "qr", "প্রিন্ট", "ডাউনলোড"] },
  { key: "tiers", words: ["vip", "standard", "difference", "parthokko", "tofat", "পার্থক্য", "ভিআইপি"] },
  { key: "groupBooking", words: ["group", "bulk", "multiple tickets", "koyta ticket", "koyekta ticket", "ekadhik", "একাধিক", "গ্রুপ"] },
  { key: "howToBook", words: ["how to book", "how do i book", "kivabe book", "kibhabe book", "kivabe ticket", "kibhabe ticket", "ticket kinbo", "ticket kinte", "ticket katbo", "ticket kata", "book korbo", "book korte", "কিভাবে বুক", "টিকেট কিনব", "টিকিট কিনব", "টিকেট কাটব",
    /(ticket|book|টিকেট|টিকিট|বুক).*(kivabe|kibhabe|how|কিভাবে|কীভাবে)|(kivabe|kibhabe|how (do|can|to)|কিভাবে|কীভাবে).*(ticket|book|টিকেট|টিকিট|বুক)/] },
  { key: "organizer", words: ["organizer", "organiser", "host an event", "list my event", "sell tickets", "amar event", "event dite", "event post", "অর্গানাইজার", "আয়োজক"] },
  { key: "shop", words: ["shop", "merch", "merchandise", "t-shirt", "tshirt", "product", "products", "dokan", "শপ", "দোকান", "পণ্য"] },
  { key: "account", words: ["account", "sign up", "signup", "register", "login", "log in", "sign in", "password", "profile", "একাউন্ট", "অ্যাকাউন্ট", "লগইন", "পাসওয়ার্ড"] },
  { key: "contact", words: ["contact", "phone", "phone number", "call center", "call korbo", "email", "address", "office", "hotline", "support", "jogajog", "যোগাযোগ", "ফোন", "ঠিকানা", "অফিস", "নাম্বার"] },
  { key: "about", words: ["who are you", "what is dream craft", "about you", "tumi ke", "apni ke", "tomar nam", "apnar nam", "তুমি কে", "আপনি কে", "dream craft ki"] },
];

export function findFaq(text: string): FaqKey | undefined {
  return FAQ.find((f) => has(text, f.words))?.key;
}

export const GREETING = ["hi", "hello", "hey", "hlw", "hellow", "salam", "assalamu alaikum", "assalamualaikum", "slm", "adab", "namaskar", "good morning", "good evening", "kemon achen", "kemon acho", "হাই", "হ্যালো", "সালাম", "আসসালামু আলাইকুম", "কেমন আছেন", "নমস্কার"];
export const THANKS = ["thanks", "thank you", "thank u", "thx", "tnx", "dhonnobad", "dhonyobad", "shukriya", "ধন্যবাদ", "শুকরিয়া"];
export const BYE = ["bye", "goodbye", "see you", "allah hafez", "khoda hafez", "pore kotha hobe", "বিদায়", "আল্লাহ হাফেজ", "খোদা হাফেজ"];
export const HELP = ["help", "menu", "options", "what can you do", "ki korte paro", "ki korte paren", "sahajjo", "shahajjo", "সাহায্য", "কি করতে পারো", "কী করতে পারেন"];
export const AFFIRM = ["yes", "yeah", "yep", "ok", "okay", "sure", "ha", "haa", "haan", "hae", "hmm", "ji", "jee", "thik ache", "accha", "হ্যাঁ", "জি", "ঠিক আছে"];

// ---------------------------------------------------------------- event title matching

const TITLE_STOPWORDS = new Set(["the", "and", "of", "a", "an", "day", "night", "2026", "2027", "2028", "event", "events"]);

export function titleTokens(title: string) {
  return normalize(title)
    .replace(/[&']/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !TITLE_STOPWORDS.has(t));
}

/**
 * 0..1 — how clearly the message names an event title. Needs two title words
 * (or the whole title), so "tech event" stays a category search while
 * "tech expo" finds Tech Expo 2027.
 */
export function titleScore(text: string, title: string) {
  const tokens = titleTokens(title);
  if (!tokens.length) return 0;
  const words = new Set(text.split(/[^a-z0-9]+/));
  const hits = tokens.filter((t) => words.has(t) || words.has(`${t}s`) || words.has(t.replace(/s$/, ""))).length;
  if (hits < 2 && hits < tokens.length) return 0;
  return hits / tokens.length;
}

export function banglishHits(raw: string) {
  return normalize(raw).split(" ").filter((w) => BANGLISH_SET.has(w)).length;
}
