import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions about tickets, orders or planning an event? Get in touch with the Dream Craft Events team.",
};

const DETAILS = [
  { icon: MapPin, label: "Office", value: "House 12, Road 7, Dhanmondi, Dhaka 1205" },
  { icon: Phone, label: "Phone", value: "+880 1700-000000", href: "tel:+8801700000000" },
  { icon: Mail, label: "Email", value: "hello@dreamcraft.dev", href: "mailto:hello@dreamcraft.dev" },
  { icon: Clock, label: "Hours", value: "Saturday to Thursday, 10am to 7pm" },
];

export default function ContactPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[340px_1fr]">
      <div>
        <h1 className="text-4xl font-bold">Get in touch</h1>
        <p className="mt-3 text-muted-foreground">Questions about a ticket, an order or a custom event? Send us a message and we&apos;ll reply within one working day.</p>
        <ul className="mt-8 space-y-5">
          {DETAILS.map(({ icon: Icon, label, value, href }) => (
            <li key={label} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              <span>
                <span className="block text-sm text-muted-foreground">{label}</span>
                {href ? (
                  <a href={href} className="font-medium hover:text-primary">
                    {value}
                  </a>
                ) : (
                  <span className="font-medium">{value}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <ContactForm />
    </div>
  );
}
