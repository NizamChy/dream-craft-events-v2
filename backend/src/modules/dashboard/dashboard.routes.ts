import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { authenticate, authorize, currentUser } from "../../middlewares/auth.js";

const router = Router();
router.use(authenticate);

const MONTHS = 6;

function monthBuckets() {
  const now = new Date();
  const buckets: { key: string; label: string; tickets: number; shop: number }[] = [];
  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleString("en-US", { month: "short" }),
      tickets: 0,
      shop: 0,
    });
  }
  const since = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1), 1);
  return { buckets, since };
}

const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

const recentBookingInclude = {
  event: { select: { id: true, title: true, slug: true } },
  user: { select: { firstName: true, lastName: true, email: true } },
} as const;

router.get("/admin", authorize("ADMIN"), async (_req, res) => {
  const now = new Date();
  const { buckets, since } = monthBuckets();

  const [
    usersByRole,
    totalEvents,
    upcomingEvents,
    ticketAgg,
    orderAgg,
    pendingCustom,
    pendingOrganizer,
    unreadMessages,
    subscribers,
    paidBookings,
    paidOrders,
    categoryRows,
    recentBookings,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.event.count(),
    prisma.event.count({ where: { startsAt: { gte: now }, isPublished: true } }),
    prisma.booking.aggregate({ where: { status: "PAID" }, _sum: { totalCents: true, quantity: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { totalCents: true }, _count: { _all: true } }),
    prisma.customEventRequest.count({ where: { status: "PENDING" } }),
    prisma.organizerRequest.count({ where: { status: "PENDING" } }),
    prisma.contactMessage.count({ where: { isRead: false } }),
    prisma.newsletterSubscriber.count(),
    prisma.booking.findMany({ where: { status: "PAID", paidAt: { gte: since } }, select: { paidAt: true, totalCents: true } }),
    prisma.order.findMany({ where: { paymentStatus: "PAID", paidAt: { gte: since } }, select: { paidAt: true, totalCents: true } }),
    prisma.booking.findMany({ where: { status: "PAID" }, select: { quantity: true, event: { select: { category: true } } } }),
    prisma.booking.findMany({ where: { status: "PAID" }, include: recentBookingInclude, orderBy: { paidAt: "desc" }, take: 6 }),
  ]);

  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const b of paidBookings) if (b.paidAt) byKey.get(keyOf(b.paidAt))!.tickets += b.totalCents;
  for (const o of paidOrders) if (o.paidAt) byKey.get(keyOf(o.paidAt))!.shop += o.totalCents;

  const categories = new Map<string, number>();
  for (const row of categoryRows) categories.set(row.event.category, (categories.get(row.event.category) ?? 0) + row.quantity);

  const roles = Object.fromEntries(usersByRole.map((r) => [r.role, r._count._all]));

  res.json({
    totals: {
      users: (roles.USER ?? 0) + (roles.ORGANIZER ?? 0) + (roles.ADMIN ?? 0),
      usersByRole: { USER: roles.USER ?? 0, ORGANIZER: roles.ORGANIZER ?? 0, ADMIN: roles.ADMIN ?? 0 },
      events: totalEvents,
      upcomingEvents,
      ticketsSold: ticketAgg._sum.quantity ?? 0,
      paidBookings: ticketAgg._count._all,
      ticketRevenueCents: ticketAgg._sum.totalCents ?? 0,
      paidOrders: orderAgg._count._all,
      shopRevenueCents: orderAgg._sum.totalCents ?? 0,
      pendingCustomEvents: pendingCustom,
      pendingOrganizerRequests: pendingOrganizer,
      unreadMessages,
      subscribers,
    },
    revenueByMonth: buckets.map(({ label, tickets, shop }) => ({ month: label, tickets, shop })),
    ticketsByCategory: [...categories.entries()].map(([category, tickets]) => ({ category, tickets })).sort((a, b) => b.tickets - a.tickets),
    recentBookings,
  });
});

router.get("/organizer", authorize("ORGANIZER", "ADMIN"), async (req, res) => {
  const me = currentUser(req);
  const now = new Date();
  const { buckets, since } = monthBuckets();

  const [events, agg, paidBookings, recentBookings] = await Promise.all([
    prisma.event.findMany({
      where: { organizerId: me.id },
      select: { id: true, title: true, slug: true, startsAt: true, totalSeats: true, seatsSold: true, isPublished: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.booking.aggregate({
      where: { status: "PAID", event: { organizerId: me.id } },
      _sum: { totalCents: true, quantity: true },
      _count: { _all: true },
    }),
    prisma.booking.findMany({
      where: { status: "PAID", paidAt: { gte: since }, event: { organizerId: me.id } },
      select: { paidAt: true, totalCents: true },
    }),
    prisma.booking.findMany({
      where: { status: "PAID", event: { organizerId: me.id } },
      include: recentBookingInclude,
      orderBy: { paidAt: "desc" },
      take: 6,
    }),
  ]);

  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const b of paidBookings) if (b.paidAt) byKey.get(keyOf(b.paidAt))!.tickets += b.totalCents;

  res.json({
    totals: {
      events: events.length,
      upcomingEvents: events.filter((e) => e.startsAt >= now).length,
      ticketsSold: agg._sum.quantity ?? 0,
      paidBookings: agg._count._all,
      revenueCents: agg._sum.totalCents ?? 0,
    },
    revenueByMonth: buckets.map(({ label, tickets }) => ({ month: label, tickets })),
    eventSales: events
      .filter((e) => e.startsAt >= now)
      .slice(0, 6)
      .map((e) => ({ ...e, occupancy: e.totalSeats ? Math.round((e.seatsSold / e.totalSeats) * 100) : 0 })),
    recentBookings,
  });
});

router.get("/user", async (req, res) => {
  const me = currentUser(req);
  const now = new Date();
  const [ticketAgg, orderAgg, upcoming, pendingCustom, unseenCustom, wishlist, organizerRequest] = await Promise.all([
    prisma.booking.aggregate({ where: { userId: me.id, status: "PAID" }, _sum: { totalCents: true, quantity: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { userId: me.id, paymentStatus: "PAID" }, _sum: { totalCents: true }, _count: { _all: true } }),
    prisma.booking.findMany({
      where: { userId: me.id, status: "PAID", event: { startsAt: { gte: now } } },
      include: { event: { select: { id: true, title: true, slug: true, image: true, startsAt: true, venue: true, city: true } } },
      orderBy: { event: { startsAt: "asc" } },
      take: 4,
    }),
    prisma.customEventRequest.count({ where: { userId: me.id, status: "PENDING" } }),
    prisma.customEventRequest.count({ where: { userId: me.id, seenByUser: false } }),
    prisma.wishlistItem.count({ where: { userId: me.id } }),
    prisma.organizerRequest.findFirst({ where: { userId: me.id }, orderBy: { createdAt: "desc" }, select: { status: true } }),
  ]);

  res.json({
    totals: {
      tickets: ticketAgg._sum.quantity ?? 0,
      bookings: ticketAgg._count._all,
      orders: orderAgg._count._all,
      totalSpentCents: (ticketAgg._sum.totalCents ?? 0) + (orderAgg._sum.totalCents ?? 0),
      pendingCustomEvents: pendingCustom,
      unseenCustomEventUpdates: unseenCustom,
      wishlist,
    },
    organizerRequestStatus: organizerRequest?.status ?? null,
    upcoming,
  });
});

export default router;
