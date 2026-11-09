/**
 * Development seed. WARNING: wipes all application tables first.
 * Run: npm run db:seed
 */
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { EventCategory, Role } from "../src/generated/prisma/enums.js";
import { estimateCost } from "../src/modules/custom-events/pricing.js";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "Demo@1234";

// Deterministic pseudo random generator so every seed produces the same data.
let state = 20261108;
const rand = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const day = 24 * 60 * 60 * 1000;
const fromNow = (days: number, hour = 10) => {
  const d = new Date(Date.now() + days * day);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const code = (prefix: string) => `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
const img = (folder: string, name: string) => `/uploads/seed/${folder}/${name}.webp`;

async function wipe() {
  const tables = [
    "WishlistItem", "OrderItem", "Order", "Booking", "Event", "Product", "CustomEventRequest",
    "OrganizerRequest", "Review", "RefreshToken", "ContactMessage", "NewsletterSubscriber", "User",
  ];
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

async function main() {
  console.log("🌱 Seeding database…");
  await wipe();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // ---------- Users ----------
  const userSeeds: { firstName: string; lastName: string; email: string; role: Role; avatar?: string; city?: string; bio?: string }[] = [
    { firstName: "Ayesha", lastName: "Rahman", email: "admin@dreamcraft.dev", role: "ADMIN", city: "Dhaka", bio: "Platform administrator at Dream Craft Events." },
    { firstName: "Nizam", lastName: "Uddin", email: "organizer@dreamcraft.dev", role: "ORGANIZER", avatar: "/images/team/nizam.webp", city: "Dhaka", bio: "Event organizer focused on tech and business summits." },
    { firstName: "Rakib", lastName: "Hasan", email: "user@dreamcraft.dev", role: "USER", avatar: "/images/team/rakib.webp", city: "Chattogram", bio: "Music lover and weekend explorer." },
    { firstName: "Nelima", lastName: "Akter", email: "nelima@dreamcraft.dev", role: "ORGANIZER", avatar: "/images/team/nelima.webp", city: "Sylhet" },
    { firstName: "Saikat", lastName: "Das", email: "saikat@dreamcraft.dev", role: "USER", avatar: "/images/team/saikat.webp", city: "Khulna" },
    { firstName: "Mamun", lastName: "Hossain", email: "mamun@dreamcraft.dev", role: "USER", avatar: "/images/team/mamun.webp", city: "Rajshahi" },
    { firstName: "Ali", lastName: "Ahmed", email: "ali@dreamcraft.dev", role: "USER", avatar: "/images/team/ali.webp", city: "Dhaka" },
    { firstName: "Farhana", lastName: "Islam", email: "farhana@dreamcraft.dev", role: "USER", city: "Dhaka" },
    { firstName: "Tanvir", lastName: "Chowdhury", email: "tanvir@dreamcraft.dev", role: "USER", city: "Cumilla" },
    { firstName: "Sadia", lastName: "Karim", email: "sadia@dreamcraft.dev", role: "USER", city: "Barishal" },
  ];
  const users = [];
  for (const u of userSeeds) {
    users.push(await prisma.user.create({ data: { ...u, passwordHash, country: "Bangladesh" } }));
  }
  const [admin, organizer, demoUser, organizer2] = users as [typeof users[0], typeof users[0], typeof users[0], typeof users[0]];
  const buyers = users.filter((u) => u.role === "USER");

  // ---------- Events ----------
  type EventSeed = {
    title: string; image: string; category: EventCategory; venue: string; city: string; days: number;
    seats: number; standard: number; vip: number; featured?: boolean; org?: "a" | "b" | "admin";
    summary: string; description: string; speakers: string[]; sponsors: string[];
  };
  const eventSeeds: EventSeed[] = [
    { title: "Tech Expo 2027", image: "tech-expo", category: "TECHNOLOGY", venue: "International Convention City Bashundhara", city: "Dhaka", days: 18, seats: 500, standard: 100000, vip: 250000, featured: true, org: "a",
      summary: "Discover the latest tech trends, live product demos and keynotes from industry leaders.",
      description: "Tech Expo brings together founders, engineers and product teams for two days of keynotes, hands-on workshops and live demos. Explore AI, cloud, fintech and hardware showcases, meet hiring companies and network with 500+ attendees. VIP tickets include reserved front-row seating, the speakers' lounge and recorded sessions.",
      speakers: ["Sadia Rahman", "Arif Hossain", "Lena Ortiz"], sponsors: ["CloudNest", "ByteWorks"] },
    { title: "Art & Culture Festival", image: "art-culture-festival", category: "ARTS", venue: "Shilpakala Academy", city: "Dhaka", days: 26, seats: 800, standard: 30000, vip: 80000, featured: true, org: "b",
      summary: "A vibrant celebration of colour, music, dance and creativity from local and global artists.",
      description: "Immerse yourself in a full day of live performances, art installations, colour play and cultural showcases. Enjoy folk music, contemporary dance, a street food court and workshops for kids and adults. VIP passes include the artists' meet & greet and a festival merchandise kit.",
      speakers: ["Mitali Sen", "Kabir Ahmed"], sponsors: ["Canvas & Co."] },
    { title: "Fitness Challenge Day", image: "fitness-challenge", category: "HEALTH", venue: "Gulshan Fitness Park", city: "Dhaka", days: 12, seats: 300, standard: 50000, vip: 120000, org: "b",
      summary: "Workouts, wellness seminars and team challenges for a healthier lifestyle.",
      description: "Join coaches and nutritionists for a high-energy day of group workouts, mobility sessions and friendly team challenges. Learn practical tips on nutrition, sleep and recovery. VIP includes a personal fitness assessment and a post-event recovery session.",
      speakers: ["Coach Imran", "Dr. Nusrat Jahan"], sponsors: ["FitLife", "HydraPure"] },
    { title: "Music Fest Extravaganza", image: "music-fest", category: "MUSIC", venue: "Army Stadium", city: "Dhaka", days: 34, seats: 1200, standard: 150000, vip: 400000, featured: true, org: "a",
      summary: "A night of live bands, DJs and spectacular light shows under the open sky.",
      description: "Six headline acts, two stages and an unforgettable light show. From indie rock to electronic, Music Fest Extravaganza is the biggest live music night of the season. VIP tickets include the front-stage zone, a dedicated bar and express entry.",
      speakers: ["Arnob & Friends", "DJ Nova", "The Skyline"], sponsors: ["SoundWave", "Pulse Energy"] },
    { title: "Entrepreneurship Summit", image: "entrepreneurship-summit", category: "BUSINESS", venue: "Radisson Blu Water Garden", city: "Dhaka", days: 22, seats: 250, standard: 200000, vip: 500000, featured: true, org: "a",
      summary: "Connect with founders and investors and learn how to scale your business.",
      description: "Hear from founders who built category leaders, join panels on fundraising and growth, and pitch your idea during open office hours with investors. VIP tickets include a private investor roundtable and the closing dinner.",
      speakers: ["Farzana Chowdhury", "Michael Grant", "Tanim Reza"], sponsors: ["Venture Bridge", "StartUp BD"] },
    { title: "Science & Discovery Expo", image: "science-expo", category: "EDUCATION", venue: "National Science Museum", city: "Dhaka", days: 40, seats: 500, standard: 20000, vip: 50000, org: "b",
      summary: "Hands-on experiments, robotics and science shows for curious minds of every age.",
      description: "Explore interactive exhibits, watch live science shows and build your own robot in our maker zone. Perfect for families, students and teachers. VIP includes a guided lab tour and a science kit to take home.",
      speakers: ["Dr. Hasan Mahmud", "Prof. Anika Roy"], sponsors: ["EduSpark"] },
    { title: "Fashion Showcase", image: "fashion-showcase", category: "ENTERTAINMENT", venue: "Le Méridien Ballroom", city: "Dhaka", days: 48, seats: 400, standard: 150000, vip: 350000, org: "a",
      summary: "Runway shows from emerging designers and the season's boldest trends.",
      description: "Witness runway collections from 12 emerging designers, a sustainable fashion panel and a pop-up marketplace. VIP tickets include front-row seating and backstage access after the show.",
      speakers: ["Bibi Russell", "Rana Ahmed"], sponsors: ["Aarong", "Style Hub"] },
    { title: "Film Buff Movie Marathon", image: "film-marathon", category: "ENTERTAINMENT", venue: "Star Cineplex", city: "Dhaka", days: 9, seats: 200, standard: 40000, vip: 80000, org: "b",
      summary: "Back-to-back classics, cosy seating and unlimited popcorn for film lovers.",
      description: "Settle in for a 12-hour marathon of award-winning classics with short director talks between screenings. VIP recliners include unlimited popcorn, drinks and a collectible poster.",
      speakers: ["Mostofa Sarwar"], sponsors: ["CineMax"] },
    { title: "Developer Conference 2027", image: "developer-conference", category: "TECHNOLOGY", venue: "Bangabandhu International Conference Center", city: "Dhaka", days: 60, seats: 700, standard: 120000, vip: 300000, featured: true, org: "a",
      summary: "Deep-dive talks on web, AI and cloud from engineers who ship at scale.",
      description: "Two tracks of technical talks, live coding sessions and architecture clinics. Topics include TypeScript at scale, AI agents in production, Postgres performance and modern frontend tooling. VIP includes workshop seats and the speakers' dinner.",
      speakers: ["Rafiq Islam", "Priya Natarajan", "Tom Becker"], sponsors: ["DevStack", "CloudNest"] },
    { title: "New Year Countdown Night", image: "new-year-countdown", category: "MUSIC", venue: "Hatirjheel Amphitheatre", city: "Dhaka", days: 54, seats: 1500, standard: 100000, vip: 300000, org: "admin",
      summary: "Ring in the new year with live music, fireworks and a giant countdown.",
      description: "Celebrate with live bands, a DJ set and a midnight fireworks show over the lake. Food stalls and family zones open all evening. VIP includes the lakeside deck and a welcome drink.",
      speakers: ["Band Chirkutt", "DJ Rahat"], sponsors: ["City Lights"] },
    { title: "Startup Pitch Night", image: "startup-pitch-night", category: "BUSINESS", venue: "Innovation Hub, Banani", city: "Dhaka", days: 15, seats: 150, standard: 30000, vip: 70000, org: "a",
      summary: "Watch 10 startups pitch to a live panel of investors and vote for your favourite.",
      description: "Ten early-stage startups get five minutes each to win over investors and the audience. Stay for the networking session afterwards. VIP includes a reserved table and a 1:1 slot with a panelist.",
      speakers: ["Shameem Ahsan", "Nadia Kabir"], sponsors: ["Venture Bridge"] },
    { title: "Street Food Carnival", image: "street-food-carnival", category: "FOOD", venue: "Rabindra Sarobar", city: "Dhaka", days: 6, seats: 600, standard: 15000, vip: 40000, org: "b",
      summary: "Fifty food stalls, live cooking battles and music all evening long.",
      description: "Taste dishes from fifty of the city's best street food vendors, watch chefs compete in live cooking battles and enjoy acoustic sets. VIP passes include tasting tokens and a reserved seating area.",
      speakers: ["Chef Tony Khan"], sponsors: ["FoodPanda", "Pran"] },
    { title: "Green Living Expo", image: "green-living-expo", category: "OTHER", venue: "Sustainable Living Hall", city: "Chattogram", days: -20, seats: 250, standard: 20000, vip: 50000, org: "b",
      summary: "Eco-friendly products, sustainability talks and green innovation.",
      description: "Learn about eco-friendly living, renewable energy and sustainable design from experts and innovators. Browse green products and join hands-on workshops on composting and upcycling.",
      speakers: ["Dr. Saleemul Huq"], sponsors: ["GreenEarth"] },
    { title: "Summer Carnival", image: "summer-carnival", category: "ENTERTAINMENT", venue: "Fantasy Kingdom", city: "Dhaka", days: -45, seats: 900, standard: 50000, vip: 120000, org: "a",
      summary: "Rides, games and live shows for the whole family.",
      description: "A full day of rides, carnival games, magic shows and live music. Fun for kids and adults alike, with food courts and shaded family zones throughout the park.",
      speakers: ["Magic Mamun"], sponsors: ["Fun World"] },
  ];

  const events = [];
  for (const [i, e] of eventSeeds.entries()) {
    const startsAt = fromNow(e.days, pick([10, 11, 15, 17, 18]));
    const organizerId = e.org === "b" ? organizer2.id : e.org === "admin" ? admin.id : organizer.id;
    events.push(
      await prisma.event.create({
        data: {
          title: e.title,
          slug: e.title.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          summary: e.summary,
          description: e.description,
          category: e.category,
          venue: e.venue,
          city: e.city,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 6 * 60 * 60 * 1000),
          image: img("events", e.image),
          speakers: e.speakers,
          sponsors: e.sponsors,
          totalSeats: e.seats,
          standardPriceCents: e.standard,
          vipPriceCents: e.vip,
          isFeatured: e.featured ?? false,
          organizerId,
          createdAt: new Date(Date.now() - (120 - i * 3) * day),
        },
      }),
    );
  }

  // ---------- Bookings (paid ones spread over the last 6 months) ----------
  const sold = new Map<string, number>();
  let bookingCount = 0;
  for (const event of events) {
    const n = int(3, 9);
    for (let k = 0; k < n; k++) {
      const buyer = pick(buyers);
      const tier = rand() < 0.3 ? "VIP" : "STANDARD";
      const quantity = int(1, 4);
      const unit = tier === "VIP" ? event.vipPriceCents : event.standardPriceCents;
      const paidAt = new Date(Math.min(Date.now() - int(1, 170) * day, event.startsAt.getTime() - day));
      await prisma.booking.create({
        data: {
          code: code("TKT"), userId: buyer.id, eventId: event.id, tier, quantity,
          unitPriceCents: unit, totalCents: unit * quantity, status: "PAID",
          paidAt, transactionId: `DEMO-${randomUUID()}`, createdAt: paidAt,
        },
      });
      sold.set(event.id, (sold.get(event.id) ?? 0) + quantity);
      bookingCount++;
    }
  }
  // A pending and a failed booking for the demo user, to show those states.
  const upcoming = events.filter((e) => e.startsAt > new Date());
  for (const [status, event] of [["PENDING", upcoming[2]!], ["FAILED", upcoming[4]!]] as const) {
    await prisma.booking.create({
      data: { code: code("TKT"), userId: demoUser.id, eventId: event.id, tier: "STANDARD", quantity: 1, unitPriceCents: event.standardPriceCents, totalCents: event.standardPriceCents, status },
    });
  }
  // Guarantee the demo user has upcoming paid tickets.
  for (const event of [upcoming[0]!, upcoming[3]!]) {
    const paidAt = new Date(Date.now() - int(2, 20) * day);
    await prisma.booking.create({
      data: { code: code("TKT"), userId: demoUser.id, eventId: event.id, tier: "VIP", quantity: 2, unitPriceCents: event.vipPriceCents, totalCents: event.vipPriceCents * 2, status: "PAID", paidAt, transactionId: `DEMO-${randomUUID()}`, createdAt: paidAt },
    });
    sold.set(event.id, (sold.get(event.id) ?? 0) + 2);
  }
  for (const [eventId, seatsSold] of sold) await prisma.event.update({ where: { id: eventId }, data: { seatsSold } });

  // ---------- Products ----------
  const productSeeds = [
    ["Balloon Party Pack", "balloons", 35000, 120, "Colourful latex balloons to add a festive touch to birthdays, weddings and celebrations. Pack of 50."],
    ["Fireworks Display Kit", "fireworks", 450000, 25, "A professional-grade aerial fireworks set to light up the sky and create a memorable finale."],
    ["Colour Splash Powder", "color-splash", 60000, 80, "Skin-safe, vibrant colour powders for colour runs, Holi and festival celebrations. 6 colours."],
    ["Confetti Cannons", "confetti-cannon", 90000, 60, "Handheld confetti cannons that burst metallic confetti up to 8 metres. Set of 4."],
    ["Sparkler Sticks", "sparkler-sticks", 30000, 200, "Long-burning sparklers for grand entrances, weddings and birthday cakes. Box of 24."],
    ["Birthday Decor Kit", "birthday-decor-kit", 120000, 45, "Everything you need for a stylish birthday: number balloons, banner, table confetti and candles."],
    ["Party Tent (6×6m)", "party-tent", 1800000, 10, "Weather-resistant canopy tent with side walls and fairy lights, ideal for outdoor events."],
    ["LED Stage Lighting Set", "stage-lighting", 950000, 18, "DMX-ready LED par lights with remote control to set the mood for concerts and parties."],
    ["Metallic Balloon Ceiling", "metallic-balloons", 75000, 35, "Chrome-finish balloons with curling ribbon for a stunning balloon ceiling. Pack of 40."],
    ["Helium Balloon Bouquet", "balloon-bouquet", 150000, 0, "A ready-to-go bouquet of helium balloons in classic colours — perfect as a gift or centrepiece."],
  ] as const;
  const products = [];
  for (const [name, image, price, stock, description] of productSeeds) {
    products.push(
      await prisma.product.create({
        data: { name, slug: image, description, priceCents: price, stock, image: img("products", image) },
      }),
    );
  }

  // ---------- Orders ----------
  const statuses = ["PROCESSING", "SHIPPED", "DELIVERED", "DELIVERED"] as const;
  for (let k = 0; k < 16; k++) {
    const buyer = k < 3 ? demoUser : pick(buyers);
    const lines = new Map<string, { p: (typeof products)[number]; q: number }>();
    for (let j = 0; j < int(1, 3); j++) {
      const p = pick(products.filter((x) => x.stock > 0));
      lines.set(p.id, { p, q: int(1, 3) });
    }
    const items = [...lines.values()].map(({ p, q }) => ({ productId: p.id, name: p.name, image: p.image, priceCents: p.priceCents, quantity: q }));
    const paidAt = new Date(Date.now() - int(1, 170) * day);
    await prisma.order.create({
      data: {
        code: code("ORD"), userId: buyer.id, status: pick(statuses), paymentStatus: "PAID",
        totalCents: items.reduce((s, i) => s + i.priceCents * i.quantity, 0),
        shippingAddress: `House ${int(1, 99)}, Road ${int(1, 30)}, ${buyer.city ?? "Dhaka"}`,
        phone: `+8801${int(300000000, 999999999)}`, paidAt, transactionId: `DEMO-${randomUUID()}`, createdAt: paidAt,
        items: { create: items },
      },
    });
  }

  // ---------- Custom event requests ----------
  await prisma.customEventRequest.createMany({
    data: [
      { userId: demoUser.id, eventType: "Wedding", eventDate: fromNow(75), location: "Chattogram Club", guestRange: "UP_TO_500", mediaPackage: "PHOTO_AND_VIDEO", catering: true, phone: "+8801711000000", notes: "Evening reception with a garden theme.", estimatedCostCents: estimateCost("UP_TO_500", "PHOTO_AND_VIDEO", true), status: "APPROVED", adminNote: "Approved! Our planner will call you this week to finalise the décor.", seenByUser: false },
      { userId: demoUser.id, eventType: "Birthday", eventDate: fromNow(30), location: "Home, GEC Circle", guestRange: "UP_TO_250", mediaPackage: "PHOTOGRAPHY", catering: false, phone: "+8801711000000", estimatedCostCents: estimateCost("UP_TO_250", "PHOTOGRAPHY", false), status: "PENDING" },
      { userId: buyers[2]!.id, eventType: "Corporate Event", eventDate: fromNow(40), location: "Gulshan 2, Dhaka", guestRange: "UP_TO_1000", mediaPackage: "VIDEOGRAPHY", catering: true, phone: "+8801812000000", notes: "Annual town hall with a stage and live streaming.", estimatedCostCents: estimateCost("UP_TO_1000", "VIDEOGRAPHY", true), status: "PENDING" },
      { userId: buyers[3]!.id, eventType: "Anniversary", eventDate: fromNow(20), location: "Sylhet", guestRange: "UP_TO_250", mediaPackage: "NONE", catering: true, phone: "+8801913000000", estimatedCostCents: estimateCost("UP_TO_250", "NONE", true), status: "REJECTED", adminNote: "Unfortunately we are fully booked on that date. Please choose another date." },
    ],
  });

  // ---------- Organizer requests ----------
  await prisma.organizerRequest.createMany({
    data: [
      { userId: buyers[1]!.id, company: "Saikat Events Co.", experience: "3 years", skills: "Concerts, stage management, ticketing", message: "I'd love to publish my upcoming concert series here.", status: "PENDING" },
      { userId: buyers[4]!.id, company: "Bright Moments", experience: "1 year", skills: "Birthday parties, décor", status: "PENDING" },
    ],
  });

  // ---------- Reviews ----------
  const reviewTexts = [
    [5, "Booking tickets took less than a minute and the QR ticket worked perfectly at the gate. Loved it!"],
    [5, "They planned our wedding reception end to end. Décor, food and photography were all spot on."],
    [4, "Great selection of events every month. The VIP experience at Music Fest was worth every taka."],
    [5, "As an organizer, the dashboard makes it really easy to track sales and attendees in real time."],
    [4, "Smooth checkout and helpful support team. Would love to see even more events outside Dhaka."],
    [5, "The custom event planner gave me a clear price upfront. No surprises, highly recommended."],
  ] as const;
  const reviewers = [demoUser, organizer, ...buyers.slice(1, 5)];
  for (const [i, [rating, comment]] of reviewTexts.entries()) {
    await prisma.review.create({ data: { userId: reviewers[i]!.id, rating, comment } });
  }

  // ---------- Contact, newsletter, wishlist ----------
  await prisma.contactMessage.createMany({
    data: [
      { name: "Imran Kabir", email: "imran@example.com", subject: "Group booking discount", message: "Hi, we are a team of 25 people. Do you offer group discounts for the Developer Conference?" },
      { name: "Lamia Hasan", email: "lamia@example.com", subject: "Partnership", message: "We'd like to sponsor the Street Food Carnival. Who should we talk to?", isRead: true },
      { name: "John Carter", email: "john@example.com", subject: "Refund question", message: "I bought the wrong ticket tier by mistake. Can I upgrade to VIP?" },
    ],
  });
  await prisma.newsletterSubscriber.createMany({
    data: ["hello@example.com", "events.fan@example.com", "rina@example.com", "music.lover@example.com", "techie@example.com"].map((email) => ({ email })),
  });
  await prisma.wishlistItem.createMany({
    data: [upcoming[1]!, upcoming[5]!, upcoming[6]!].map((e) => ({ userId: demoUser.id, eventId: e.id })),
  });

  console.log(`✅ Seeded ${users.length} users, ${events.length} events, ${bookingCount + 4} bookings, ${products.length} products, 16 orders.`);
  console.log("\nDemo accounts (password: " + DEMO_PASSWORD + ")");
  console.log("  Admin:     admin@dreamcraft.dev");
  console.log("  Organizer: organizer@dreamcraft.dev");
  console.log("  User:      user@dreamcraft.dev");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
