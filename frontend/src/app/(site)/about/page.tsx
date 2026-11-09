import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About us",
  description: "Dream Craft Events helps people across Bangladesh discover events and plan celebrations they'll remember.",
};

const TEAM = [
  { name: "Nizam Uddin", role: "Founder", image: "/images/team/nizam.webp" },
  { name: "Nelima Akter", role: "Head of planning", image: "/images/team/nelima.webp" },
  { name: "Rakib Hasan", role: "Partnerships", image: "/images/team/rakib.webp" },
  { name: "Saikat Roy", role: "Production lead", image: "/images/team/saikat.webp" },
  { name: "Mamun Khan", role: "Photography", image: "/images/team/mamun.webp" },
  { name: "Ali Ahmed", role: "Guest experience", image: "/images/team/ali.webp" },
];

const NUMBERS = [
  { value: "1,200+", label: "events planned and ticketed" },
  { value: "85k", label: "tickets booked through the site" },
  { value: "40+", label: "trusted vendors and venues" },
];

const GALLERY = Array.from({ length: 8 }, (_, i) => `/images/gallery/gallery-${i + 1}.webp`);

export default function AboutPage() {
  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
        <div>
          <h1 className="text-4xl font-bold sm:text-5xl">We make the big nights easy</h1>
          <div className="mt-5 max-w-[60ch] space-y-4 text-lg leading-relaxed text-muted-foreground">
            <p>
              Dream Craft Events started in 2019 as a small wedding decor team in Dhaka. Couples kept asking us where to find good concerts, workshops and
              festivals, so we built a place to book them too.
            </p>
            <p>
              Today organizers use Dream Craft to sell tickets, and families use it to plan weddings, birthdays and corporate days with a planner who answers
              the phone.
            </p>
          </div>
          <dl className="mt-8 grid grid-cols-3 gap-4">
            {NUMBERS.map((n) => (
              <div key={n.label}>
                <dt className="sr-only">{n.label}</dt>
                <dd className="font-display text-3xl font-bold text-primary">{n.value}</dd>
                <dd className="mt-1 text-sm text-muted-foreground">{n.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
          <Image src="/images/about.webp" alt="The Dream Craft team setting up a stage before an event" fill preload sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </div>
      </section>

      <section className="bg-muted/50 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-3xl font-bold">The people behind the scenes</h2>
          <ul className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {TEAM.map((m) => (
              <li key={m.name}>
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                  <Image src={m.image} alt={m.name} fill sizes="(min-width: 1024px) 200px, (min-width: 640px) 30vw, 45vw" className="object-cover" />
                </div>
                <p className="mt-3 font-semibold">{m.name}</p>
                <p className="text-sm text-muted-foreground">{m.role}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <h2 className="text-3xl font-bold">From our recent events</h2>
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {GALLERY.map((src, i) => (
            <div key={src} className={`relative overflow-hidden rounded-2xl bg-muted ${i === 0 || i === 5 ? "row-span-2 aspect-[1/2]" : "aspect-square"}`}>
              <Image src={src} alt="" fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" />
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start gap-4 rounded-3xl bg-ink p-8 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-2xl font-bold">Have an occasion coming up?</p>
            <p className="mt-1 text-white/70">Get an instant estimate and a call from one of our planners.</p>
          </div>
          <Button asChild size="xl">
            <Link href="/plan-your-event">Plan your event</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
