import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { NewsletterForm } from "./newsletter-form";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/events", label: "Upcoming events" },
      { href: "/events?when=past", label: "Past events" },
      { href: "/shop", label: "Party shop" },
    ],
  },
  {
    title: "Plan with us",
    links: [
      { href: "/plan-your-event", label: "Plan a custom event" },
      { href: "/dashboard/become-organizer", label: "Become an organizer" },
      { href: "/about", label: "Our story" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/contact", label: "Contact us" },
      { href: "/dashboard/my/bookings", label: "My tickets" },
      { href: "/dashboard/my/orders", label: "Track an order" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-ink text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-10 border-b border-white/10 pb-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-md">
            <h2 className="text-2xl font-semibold">New events, every Friday.</h2>
            <p className="mt-2 text-white/65">One short email with the week&apos;s best events and early-bird prices. Unsubscribe anytime.</p>
          </div>
          <NewsletterForm />
        </div>

        <div className="grid gap-10 pt-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo inverted />
            <p className="mt-4 max-w-xs text-sm text-white/60">
              Tickets for the best concerts, summits and festivals in Bangladesh, and planners for the events that matter most to you.
            </p>
            <p className="mt-4 text-sm text-white/60">House 12, Road 7, Gulshan 1, Dhaka 1212</p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-white/60 transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-12 text-xs text-white/45">© {new Date().getFullYear()} Dream Craft Events. All rights reserved.</p>
      </div>
    </footer>
  );
}
