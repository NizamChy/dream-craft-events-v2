/**
 * End-to-end API tests against the real (seeded) database.
 * Requires: `npm run db:seed` once. Test data created here is removed afterwards.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { estimateCost } from "../src/modules/custom-events/pricing.js";

const app = createApp();
const PASSWORD = process.env.DEMO_PASSWORD || "Demo@1234";
const stamp = Date.now();
const testEmail = `test-${stamp}@example.com`;

function cookiesOf(res: request.Response): string[] {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  return (raw ?? []).map((c) => c.split(";")[0]!);
}

async function login(email: string, password = PASSWORD) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return cookiesOf(res);
}

let adminCookies: string[];
let organizerCookies: string[];
let userCookies: string[];
let newUserCookies: string[];
const createdEventIds: string[] = [];

beforeAll(async () => {
  adminCookies = await login("admin@dreamcraft.dev");
  organizerCookies = await login("organizer@dreamcraft.dev");
  userCookies = await login("user@dreamcraft.dev");
});

afterAll(async () => {
  await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.contactMessage.deleteMany({ where: { email: testEmail } });
  await prisma.newsletterSubscriber.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});

describe("health", () => {
  it("reports ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
  it("returns JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });
});

describe("auth", () => {
  it("validates registration input", async () => {
    const res = await request(app).post("/api/auth/register").send({ firstName: "", email: "bad", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty("email");
    expect(res.body.errors).toHaveProperty("password");
  });

  it("registers a new USER and sets httpOnly cookies", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ firstName: "Test", lastName: "User", email: testEmail, password: "Password123" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("USER");
    expect(res.body.user).not.toHaveProperty("passwordHash");
    const raw = (res.headers["set-cookie"] as unknown as string[]).join(";");
    expect(raw).toMatch(/access_token=.*HttpOnly/i);
    newUserCookies = cookiesOf(res);
  });

  it("rejects a duplicate email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ firstName: "Test", lastName: "User", email: testEmail.toUpperCase(), password: "Password123" });
    expect(res.status).toBe(409);
  });

  it("rejects wrong password with a generic message", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: testEmail, password: "Wrong12345" });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("returns the current user from the cookie and from a Bearer token", async () => {
    const me = await request(app).get("/api/auth/me").set("Cookie", userCookies);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("user@dreamcraft.dev");

    const login = await request(app).post("/api/auth/login").send({ email: "user@dreamcraft.dev", password: PASSWORD });
    const bearer = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(bearer.status).toBe(200);
  });

  it("rejects requests without a token", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });

  it("supports one-click demo login for every role", async () => {
    for (const role of ["ADMIN", "ORGANIZER", "USER"]) {
      const res = await request(app).post("/api/auth/demo-login").send({ role });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe(role);
    }
  });

  it("rotates refresh tokens and detects reuse", async () => {
    const cookies = await login(testEmail, "Password123");
    const first = await request(app).post("/api/auth/refresh").set("Cookie", cookies);
    expect(first.status).toBe(200);
    // Re-using the old (now revoked) refresh token must fail…
    const reuse = await request(app).post("/api/auth/refresh").set("Cookie", cookies);
    expect(reuse.status).toBe(401);
    // …and revokes the whole family, so the newly issued token is dead too.
    const after = await request(app).post("/api/auth/refresh").set("Cookie", cookiesOf(first));
    expect(after.status).toBe(401);
  });

  it("GET /refresh redirects to login with a safe redirect target", async () => {
    const res = await request(app).get("/api/auth/refresh?redirect=//evil.com");
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/login?redirect=%2F");
  });

  it("logout revokes the refresh token", async () => {
    const cookies = await login(testEmail, "Password123");
    await request(app).post("/api/auth/logout").set("Cookie", cookies).expect(200);
    expect((await request(app).post("/api/auth/refresh").set("Cookie", cookies)).status).toBe(401);
  });
});

describe("role based access control", () => {
  it("USER cannot access admin or organizer endpoints", async () => {
    expect((await request(app).get("/api/users").set("Cookie", userCookies)).status).toBe(403);
    expect((await request(app).get("/api/dashboard/admin").set("Cookie", userCookies)).status).toBe(403);
    expect((await request(app).get("/api/events/manage/list").set("Cookie", userCookies)).status).toBe(403);
    expect((await request(app).post("/api/products").set("Cookie", userCookies).send({})).status).toBe(403);
  });

  it("ORGANIZER can manage events but not users", async () => {
    expect((await request(app).get("/api/events/manage/list").set("Cookie", organizerCookies)).status).toBe(200);
    expect((await request(app).get("/api/users").set("Cookie", organizerCookies)).status).toBe(403);
  });

  it("ADMIN can list users without leaking password hashes", async () => {
    const res = await request(app).get("/api/users?limit=5").set("Cookie", adminCookies);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("role changes take effect immediately (no stale token role)", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
    await request(app).patch(`/api/users/${user.id}`).set("Cookie", adminCookies).send({ role: "ORGANIZER" }).expect(200);
    expect((await request(app).get("/api/events/manage/list").set("Cookie", newUserCookies)).status).toBe(200);
    await request(app).patch(`/api/users/${user.id}`).set("Cookie", adminCookies).send({ role: "USER" }).expect(200);
    expect((await request(app).get("/api/events/manage/list").set("Cookie", newUserCookies)).status).toBe(403);
  });

  it("admin cannot demote themselves", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@dreamcraft.dev" } });
    const res = await request(app).patch(`/api/users/${admin.id}`).set("Cookie", adminCookies).send({ role: "USER" });
    expect(res.status).toBe(400);
  });
});

describe("events", () => {
  it("lists upcoming published events with pagination", async () => {
    const res = await request(app).get("/api/events?limit=3");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.meta.total).toBeGreaterThan(3);
    for (const e of res.body.items) expect(new Date(e.startsAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("filters by category and search", async () => {
    const res = await request(app).get("/api/events?category=TECHNOLOGY&search=expo");
    expect(res.status).toBe(200);
    expect(res.body.items.every((e: { category: string }) => e.category === "TECHNOLOGY")).toBe(true);
  });

  it("returns a single event by slug", async () => {
    const res = await request(app).get("/api/events/tech-expo-2027");
    expect(res.status).toBe(200);
    expect(res.body.event.title).toBe("Tech Expo 2027");
    expect(res.body.event).toHaveProperty("seatsLeft");
  });

  it("organizer creates, edits and deletes their own event; other organizers cannot touch it", async () => {
    const body = {
      title: "Test Event " + stamp,
      summary: "A short summary for testing",
      description: "A sufficiently long description used by the automated test suite.",
      category: "TECHNOLOGY",
      venue: "Test Hall",
      city: "Dhaka",
      startsAt: new Date(Date.now() + 30 * 864e5).toISOString(),
      image: "/uploads/seed/events/tech-expo.webp",
      totalSeats: 2,
      standardPriceCents: 1000,
      vipPriceCents: 2000,
      isFeatured: true,
    };
    const created = await request(app).post("/api/events").set("Cookie", organizerCookies).send(body);
    expect(created.status).toBe(201);
    expect(created.body.event.isFeatured).toBe(false); // only admins can feature
    const id = created.body.event.id;
    createdEventIds.push(id);

    const otherOrganizer = await login("nelima@dreamcraft.dev");
    const forbidden = await request(app).patch(`/api/events/${id}`).set("Cookie", otherOrganizer).send(body);
    expect(forbidden.status).toBe(403);

    const edited = await request(app).patch(`/api/events/${id}`).set("Cookie", organizerCookies).send({ ...body, totalSeats: 3 });
    expect(edited.status).toBe(200);
    expect(edited.body.event.totalSeats).toBe(3);
  });

  it("rejects an event in the past and VIP cheaper than standard", async () => {
    const res = await request(app).post("/api/events").set("Cookie", organizerCookies).send({
      title: "Bad", summary: "short", description: "x", category: "TECHNOLOGY", venue: "V", city: "C",
      startsAt: "2020-01-01", image: "", totalSeats: 0, standardPriceCents: 500, vipPriceCents: 100,
    });
    expect(res.status).toBe(400);
  });
});

describe("ticket booking + demo payment", () => {
  it("prevents overselling and updates seat counts", async () => {
    const eventId = createdEventIds[0]!; // 3 seats
    const b1 = await request(app).post("/api/bookings").set("Cookie", userCookies).send({ eventId, tier: "VIP", quantity: 2 });
    expect(b1.status).toBe(201);
    expect(b1.body.booking.totalCents).toBe(4000);
    expect(b1.body.booking.status).toBe("PENDING");

    const b2 = await request(app).post("/api/bookings").set("Cookie", newUserCookies).send({ eventId, tier: "STANDARD", quantity: 2 });
    expect(b2.status).toBe(201);

    const failed = await request(app).post(`/api/bookings/${b1.body.booking.id}/pay`).set("Cookie", userCookies).send({ outcome: "fail" });
    expect(failed.status).toBe(402);
    expect(failed.body.booking.status).toBe("FAILED");

    const paid = await request(app).post(`/api/bookings/${b1.body.booking.id}/pay`).set("Cookie", userCookies).send({ outcome: "success" });
    expect(paid.status).toBe(200);
    expect(paid.body.booking.status).toBe("PAID");

    const again = await request(app).post(`/api/bookings/${b1.body.booking.id}/pay`).set("Cookie", userCookies).send({});
    expect(again.status).toBe(409);

    // Only 1 seat left, the second booking (2 tickets) must be rejected at payment.
    const oversell = await request(app).post(`/api/bookings/${b2.body.booking.id}/pay`).set("Cookie", newUserCookies).send({});
    expect(oversell.status).toBe(409);

    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.seatsSold).toBe(2);
  });

  it("a user cannot pay or view someone else's booking", async () => {
    const mine = await request(app).get("/api/bookings/me").set("Cookie", userCookies);
    const id = mine.body.items[0].id;
    expect((await request(app).get(`/api/bookings/${id}`).set("Cookie", newUserCookies)).status).toBe(404);
    expect((await request(app).post(`/api/bookings/${id}/pay`).set("Cookie", newUserCookies).send({})).status).toBe(404);
  });

  it("organizer sees bookings for their events with a revenue summary", async () => {
    const res = await request(app).get("/api/bookings").set("Cookie", organizerCookies);
    expect(res.status).toBe(200);
    expect(res.body.summary.revenueCents).toBeGreaterThan(0);
  });

  it("an event with paid bookings cannot be deleted", async () => {
    const res = await request(app).delete(`/api/events/${createdEventIds[0]}`).set("Cookie", organizerCookies);
    expect(res.status).toBe(409);
  });
});

describe("shop orders", () => {
  it("computes totals from DB prices and decrements stock on payment", async () => {
    const product = await prisma.product.findFirstOrThrow({ where: { stock: { gt: 5 } } });
    const created = await request(app)
      .post("/api/orders")
      .set("Cookie", newUserCookies)
      .send({ items: [{ productId: product.id, quantity: 1 }, { productId: product.id, quantity: 1 }], shippingAddress: "House 1, Road 2, Dhaka", phone: "+8801700000000" });
    expect(created.status).toBe(201);
    expect(created.body.order.totalCents).toBe(product.priceCents * 2);
    expect(created.body.order.items).toHaveLength(1);

    const paid = await request(app).post(`/api/orders/${created.body.order.id}/pay`).set("Cookie", newUserCookies).send({});
    expect(paid.status).toBe(200);
    expect(paid.body.order.status).toBe("PROCESSING");
    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.stock).toBe(product.stock - 2);

    // Admin cancels → stock restored
    const cancel = await request(app).patch(`/api/orders/${created.body.order.id}/status`).set("Cookie", adminCookies).send({ status: "CANCELLED" });
    expect(cancel.status).toBe(200);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(product.stock);
  });

  it("rejects out-of-stock products", async () => {
    const product = await prisma.product.findFirstOrThrow({ where: { stock: 0 } });
    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", newUserCookies)
      .send({ items: [{ productId: product.id, quantity: 1 }], shippingAddress: "House 1, Road 2, Dhaka", phone: "+8801700000000" });
    expect(res.status).toBe(409);
  });
});

describe("custom events & organizer requests", () => {
  it("calculates the estimate on the server", async () => {
    const res = await request(app)
      .post("/api/custom-events")
      .set("Cookie", newUserCookies)
      .send({ eventType: "Wedding", eventDate: new Date(Date.now() + 30 * 864e5).toISOString(), location: "Dhaka Club", guestRange: "UP_TO_500", mediaPackage: "PHOTO_AND_VIDEO", catering: true, phone: "+8801700000000" });
    expect(res.status).toBe(201);
    expect(res.body.request.estimatedCostCents).toBe(estimateCost("UP_TO_500", "PHOTO_AND_VIDEO", true));
  });

  it("admin approval notifies the user (unseen counter)", async () => {
    const mine = await request(app).get("/api/custom-events/me").set("Cookie", newUserCookies);
    const id = mine.body.items[0].id;
    await request(app).patch(`/api/custom-events/${id}`).set("Cookie", adminCookies).send({ status: "APPROVED", adminNote: "See you!" }).expect(200);
    const after = await request(app).get("/api/custom-events/me").set("Cookie", newUserCookies);
    expect(after.body.unseen).toBe(1);
  });

  it("approving an organizer request promotes the user", async () => {
    const created = await request(app)
      .post("/api/organizer-requests")
      .set("Cookie", newUserCookies)
      .send({ company: "Test Co", experience: "2 years", skills: "Weddings, concerts" });
    expect(created.status).toBe(201);
    const dup = await request(app).post("/api/organizer-requests").set("Cookie", newUserCookies).send({ company: "Test Co", experience: "2 years", skills: "Weddings" });
    expect(dup.status).toBe(409);

    await request(app).patch(`/api/organizer-requests/${created.body.request.id}`).set("Cookie", adminCookies).send({ status: "APPROVED" }).expect(200);
    const me = await request(app).get("/api/auth/me").set("Cookie", newUserCookies);
    expect(me.body.user.role).toBe("ORGANIZER");
  });
});

describe("public forms & dashboards", () => {
  it("accepts contact messages and idempotent newsletter signups", async () => {
    await request(app).post("/api/contact").send({ name: "Tester", email: testEmail, subject: "Hello", message: "This is a test message." }).expect(201);
    await request(app).post("/api/newsletter").send({ email: testEmail }).expect(201);
    await request(app).post("/api/newsletter").send({ email: testEmail }).expect(201);
  });

  it("serves role dashboards", async () => {
    const admin = await request(app).get("/api/dashboard/admin").set("Cookie", adminCookies);
    expect(admin.status).toBe(200);
    expect(admin.body.revenueByMonth).toHaveLength(6);
    expect((await request(app).get("/api/dashboard/organizer").set("Cookie", organizerCookies)).status).toBe(200);
    expect((await request(app).get("/api/dashboard/user").set("Cookie", userCookies)).status).toBe(200);
  });

  it("serves optimized seed images", async () => {
    const res = await request(app).get("/uploads/seed/events/tech-expo.webp");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/webp");
    expect((await request(app).get("/uploads/nope.webp")).status).toBe(404);
  });
});
