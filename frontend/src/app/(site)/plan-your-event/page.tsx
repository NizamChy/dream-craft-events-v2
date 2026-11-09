import type { Metadata } from "next";
import Image from "next/image";
import { PlanEventForm } from "@/components/custom-events/plan-event-form";
import { parsePlanPrefill } from "@/lib/plan-prefill";

export const metadata: Metadata = {
  title: "Plan your event",
  description: "Weddings, birthdays, corporate events and more. Tell us what you need and get an instant estimate.",
};

const STEPS = [
  { title: "Tell us the basics", body: "Event type, date, guests and extras. The estimate updates as you choose." },
  { title: "Talk to a planner", body: "We call within 2 working days to understand your vision and confirm the quote." },
  { title: "Enjoy the day", body: "Our team handles decor, vendors, media and catering on the day." },
];

export default async function PlanYourEventPage({ searchParams }: PageProps<"/plan-your-event">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_440px]">
        <div>
          <h1 className="max-w-2xl text-4xl font-bold sm:text-5xl">Plan a celebration that feels like yours</h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            From intimate birthdays to thousand-guest weddings, we take care of the details so you can be present for the moments.
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-semibold">{s.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="relative hidden aspect-[4/3] overflow-hidden rounded-3xl lg:block">
          <Image src="/images/custom-event.webp" alt="A decorated wedding stage with flowers and warm lights" fill preload sizes="440px" className="object-cover" />
        </div>
      </div>

      <div className="mt-12">
        <PlanEventForm initial={parsePlanPrefill(await searchParams)} />
      </div>
    </div>
  );
}
