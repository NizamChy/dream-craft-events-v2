/**
 * Demo chatbot: language understanding (pure) + the /api/chat endpoint
 * against the seeded database.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { estimateCost } from "../src/modules/custom-events/pricing.js";
import {
  detectLang, findCatering, findCategory, findCity, findCustomEventType, findGuests, findMaxPrice, findMedia, findTimeRange,
  guestRangeFor, normalize, titleScore,
} from "../src/modules/chat/nlu.js";

const app = createApp();
const PASSWORD = process.env.DEMO_PASSWORD || "Demo@1234";

async function chat(message: string, context: object = {}, cookies: string[] = []) {
  const res = await request(app).post("/api/chat").set("Cookie", cookies).send({ message, context });
  expect(res.status).toBe(200);
  return res.body;
}

describe("chat language understanding", () => {
  it("detects the language", () => {
    expect(detectLang("What's on this weekend?")).toBe("en");
    expect(detectLang("Ei mashe ki event ache?")).toBe("banglish");
    expect(detectLang("Refund policy ki?")).toBe("banglish");
    expect(detectLang("এই মাসে কী আছে?")).toBe("bn");
  });

  it("reads Bangla digits, guests and budgets", () => {
    expect(normalize("৩০০ জন")).toBe("300 জন");
    expect(findGuests(normalize("৩০০ জনের বিয়ে"))).toBe(300);
    expect(findGuests("300 joner biye")).toBe(300);
    expect(findGuests("1 hajar guest")).toBe(1000);
    expect(findGuests("budget 5k")).toBeUndefined();
    expect(findGuests("300", true)).toBe(300);
    expect(guestRangeFor(300)).toBe("UP_TO_500");
    expect(guestRangeFor(1500)).toBeNull();
    expect(findMaxPrice("events under 500 taka")).toBe(500);
    expect(findMaxPrice("1000 takar moddhe event")).toBe(1000);
    expect(findMaxPrice("ticket 1000 taka")).toBeUndefined();
  });

  it("finds categories, cities, dates and event types", () => {
    expect(findCategory("dhakay concert ache")).toBe("MUSIC");
    expect(findCategory("show me events")).toBeUndefined();
    expect(findCity("chittagong e ki ache")).toBe("Chattogram");
    expect(findTimeRange("ei mashe ki ache")?.key).toBe("month");
    expect(findTimeRange("may i ask something")).toBeUndefined();
    const weekend = findTimeRange("this weekend", new Date(2026, 10, 9, 12))!; // Monday
    expect(weekend.from.getDay()).toBe(5);
    expect(findCustomEventType("biye plan korte chai")).toBe("Wedding");
    expect(findCustomEventType("জন্মদিনের পার্টি")).toBe("Birthday");
  });

  it("understands media and catering, including negation", () => {
    expect(findMedia("photo + video add koro")).toBe("PHOTO_AND_VIDEO");
    expect(findMedia("remove photo/video")).toBe("NONE");
    expect(findMedia("video lagbe na, shudhu photo")).toBe("PHOTOGRAPHY");
    expect(findMedia(normalize("ছবি/ভিডিও বাদ দাও"))).toBe("NONE");
    expect(findCatering("catering add koro")).toBe(true);
    expect(findCatering("catering chara")).toBe(false);
    expect(findCatering("without catering")).toBe(false);
  });

  it("needs two title words before naming a specific event", () => {
    expect(titleScore("tech expo er ticket", "Tech Expo 2027")).toBe(1);
    expect(titleScore("tech event", "Tech Expo 2027")).toBe(0);
  });
});

describe("chat endpoint", () => {
  let userCookies: string[];

  beforeAll(async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "user@dreamcraft.dev", password: PASSWORD });
    userCookies = ((res.headers["set-cookie"] as unknown as string[]) ?? []).map((c) => c.split(";")[0]!);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("validates input", async () => {
    const empty = await request(app).post("/api/chat").send({ message: "   " });
    expect(empty.status).toBe(400);
    const long = await request(app).post("/api/chat").send({ message: "a".repeat(501) });
    expect(long.status).toBe(400);
    const badContext = await request(app).post("/api/chat").send({ message: "hi", context: { evil: true } });
    expect(badContext.status).toBe(400);
  });

  it("greets in the visitor's language", async () => {
    expect((await chat("hello")).text).toMatch(/I can help/);
    expect((await chat("হ্যালো")).text).toMatch(/আমি যা করতে পারি/);
  });

  it("searches real upcoming events", async () => {
    const reply = await chat("Ei mashe ki event ache?");
    expect(reply.context.lang).toBe("banglish");
    expect(reply.events.length).toBeGreaterThan(0);
    for (const e of reply.events) expect(new Date(e.startsAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("filters by budget and sorts cheapest first", async () => {
    const reply = await chat("events under 500 taka");
    const prices = reply.events.map((e: { standardPriceCents: number }) => e.standardPriceCents);
    expect(prices.every((p: number) => p <= 50_000)).toBe(true);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it("describes a specific event with live seats and prices", async () => {
    const event = await prisma.event.findFirstOrThrow({ where: { isPublished: true, startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } });
    const reply = await chat(`${event.title} er ticket koto?`);
    expect(reply.events).toHaveLength(1);
    expect(reply.events[0].slug).toBe(event.slug);
    expect(reply.events[0].seatsLeft).toBe(Math.max(0, event.totalSeats - event.seatsSold));
  });

  it("builds a custom event quote over several turns using the real price list", async () => {
    const ask = await chat("biye plan korte chai");
    expect(ask.context.awaiting).toBe("guests");
    expect(ask.quote).toBeUndefined();

    const first = await chat("300", ask.context);
    expect(first.quote.totalCents).toBe(estimateCost("UP_TO_500", "NONE", false));
    expect(first.quote.href).toContain("guests=UP_TO_500");

    const withExtras = await chat("Catering add koro", first.context);
    const both = await chat("Photo + video add koro", withExtras.context);
    expect(both.quote.totalCents).toBe(estimateCost("UP_TO_500", "PHOTO_AND_VIDEO", true));
    expect(both.context.lang).toBe("banglish");

    const big = await chat("2000 jon er biye");
    expect(big.quote).toBeUndefined();
    expect(big.actions[0].href).toBe("/contact");
  });

  it("asks guests to sign in before showing account data", async () => {
    const reply = await chat("Amar ticket dekhao");
    expect(reply.items).toBeUndefined();
    expect(reply.actions[0].href).toMatch(/^\/login\?redirect=/);
  });

  it("shows only the signed-in user's own bookings", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "user@dreamcraft.dev" } });
    const count = await prisma.booking.count({ where: { userId: user.id } });
    const reply = await chat("Amar ticket dekhao", {}, userCookies);
    if (count === 0) {
      expect(reply.items).toBeUndefined();
    } else {
      expect(reply.items.length).toBe(Math.min(5, count));
      const codes = reply.items.map((i: { subtitle: string }) => i.subtitle.split(" ")[0]);
      const owned = await prisma.booking.count({ where: { code: { in: codes }, userId: user.id } });
      expect(owned).toBe(codes.length);
    }
  });

  it("never reveals someone else's booking by code", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "user@dreamcraft.dev" } });
    const other = await prisma.booking.findFirst({ where: { userId: { not: user.id } } });
    if (!other) return;
    const reply = await chat(other.code, {}, userCookies);
    expect(reply.items).toBeUndefined();
    expect(reply.text).toMatch(/couldn't find/i);
  });

  it("answers FAQs and falls back gracefully", async () => {
    expect((await chat("Refund policy ki?")).text).toMatch(/refund/i);
    expect((await chat("bKash diye payment kora jabe?")).text).toMatch(/demo mode/i);
    const lost = await chat("asdf qwerty");
    expect(lost.suggestions.length).toBeGreaterThan(0);
  });
});
