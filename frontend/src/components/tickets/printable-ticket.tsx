"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { LogoMark } from "@/components/brand/logo";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatDate, formatDateTime, formatMoney, formatTime, fullName } from "@/lib/format";
import type { Booking } from "@/lib/types";

/**
 * Print-only e-ticket (A4). Rendered into <body> through a portal so it
 * prints without the dashboard chrome; see the `@media print` rules in
 * globals.css. Uses fixed colours so it prints the same in dark mode.
 */
export function PrintableTicket({ booking: b }: { booking: Booking }) {
  const hydrated = useHydrated();

  // Name the saved PDF after the ticket ("Ticket TKT-XXXX - Event").
  useEffect(() => {
    const original = document.title;
    const before = () => (document.title = `Ticket ${b.code} - ${b.event.title}`);
    const after = () => (document.title = original);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [b.code, b.event.title]);

  if (!hydrated) return null;

  const vip = b.tier === "VIP";
  const holder = b.user ? fullName(b.user) : "Ticket holder";
  const admit = `Admit ${b.quantity}`;

  return createPortal(
    <div data-print-area className="hidden bg-white font-sans text-[#1E1B3A] print:block">
      {/* ---------- Ticket ---------- */}
      <div className="relative grid grid-cols-[1fr_62mm] overflow-hidden rounded-[4mm] border-[0.4mm] border-[#1E1B3A]">
        {/* Main part */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between bg-[#1E1B3A] px-[7mm] py-[4mm] text-white">
            <div className="flex items-center gap-[2.5mm]">
              <LogoMark className="size-[9mm]" />
              <div className="leading-tight">
                <p className="font-display text-[13pt] font-bold">Dream Craft Events</p>
                <p className="text-[7.5pt] text-white/70">dreamcraft.dev</p>
              </div>
            </div>
            <div className="text-right leading-tight">
              <p className="font-display text-[12pt] font-bold tracking-[0.2em]">E-TICKET</p>
              <p className="text-[8pt] text-white/70">Booking {b.code}</p>
            </div>
          </div>

          <div className="flex flex-1 flex-col px-[7mm] pt-[5mm] pb-[4mm]">
            <h1 className="font-display text-[20pt] leading-[1.15] font-bold">{b.event.title}</h1>

            <dl className="mt-[5mm] grid grid-cols-[1.4fr_0.8fr_1.6fr] gap-x-[5mm]">
              <TicketField label="Date" value={formatDate(b.event.startsAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
              <TicketField label="Time" value={formatTime(b.event.startsAt)} />
              <TicketField label="Venue" value={`${b.event.venue}, ${b.event.city}`} />
            </dl>

            <div className="my-[4mm] border-t-[0.3mm] border-[#E3E1EE]" />

            <dl className="grid grid-cols-[1.6fr_1fr_0.7fr_1fr] gap-x-[5mm]">
              <TicketField label="Ticket holder" value={holder} />
              <TicketField label="Ticket type" value={vip ? "VIP" : "Standard"} />
              <TicketField label="Quantity" value={String(b.quantity)} />
              <TicketField label="Amount paid" value={formatMoney(b.totalCents)} />
            </dl>

            <dl className="mt-auto grid grid-cols-3 gap-x-[5mm] pt-[5mm] text-[7pt]">
              <TicketField small label="Unit price" value={`${formatMoney(b.unitPriceCents)} × ${b.quantity}`} />
              <TicketField small label="Issued" value={b.paidAt ? formatDateTime(b.paidAt) : formatDateTime(b.createdAt)} />
              <TicketField small label="Transaction" value={b.transactionId ? b.transactionId.slice(0, 18) : "—"} />
            </dl>
          </div>
        </div>

        {/* Perforation with notches */}
        <div aria-hidden className="pointer-events-none absolute top-0 bottom-0 right-[62mm] w-0 border-l-[0.4mm] border-dashed border-[#B9B6CC]" />
        <div aria-hidden className="absolute -top-[3.5mm] right-[calc(62mm-3.5mm)] size-[7mm] rounded-full border-[0.4mm] border-[#1E1B3A] bg-white" />
        <div aria-hidden className="absolute -bottom-[3.5mm] right-[calc(62mm-3.5mm)] size-[7mm] rounded-full border-[0.4mm] border-[#1E1B3A] bg-white" />

        {/* Stub */}
        <div className="flex flex-col items-center text-center">
          <div className={`w-full py-[4mm] font-display text-[12pt] font-bold tracking-[0.15em] ${vip ? "bg-[#F5A524] text-[#1E1B3A]" : "bg-[#D0145F] text-white"}`}>
            {vip ? "VIP" : "STANDARD"}
          </div>
          <div className="flex flex-1 flex-col items-center justify-center px-[5mm] py-[4mm]">
            <QRCodeSVG value={b.code} size={150} level="M" marginSize={0} className="size-[36mm]" title={`Ticket code ${b.code}`} />
            <p className="mt-[3mm] font-mono text-[10pt] font-bold tracking-[0.12em]">{b.code}</p>
            <p className="mt-[1.5mm] font-display text-[14pt] font-bold">{admit}</p>
            <p className="text-[7.5pt] text-[#5F5C7E]">
              {formatDate(b.event.startsAt, { day: "numeric", month: "short", year: "numeric" })}, {formatTime(b.event.startsAt)}
            </p>
          </div>
          <p className="w-full border-t-[0.3mm] border-[#E3E1EE] py-[2mm] text-[6.5pt] text-[#5F5C7E]">Scan at the entrance</p>
        </div>
      </div>

      {/* ---------- Information ---------- */}
      <div className="mt-[9mm] grid grid-cols-[1.5fr_1fr] gap-[8mm] text-[8.5pt] leading-relaxed">
        <section>
          <h2 className="font-display text-[10.5pt] font-bold">Before you go</h2>
          <ul className="mt-[2mm] list-disc space-y-[1mm] pl-[4.5mm] text-[#3D3A5C]">
            <li>Show this ticket, printed or on your phone, at the entrance. The QR code is scanned once.</li>
            <li>
              This ticket admits {b.quantity} {b.quantity === 1 ? "person" : "people"}. All guests on this ticket should arrive and enter together.
            </li>
            <li>Gates open 30 minutes before the start time. Please carry a valid photo ID that matches the ticket holder.</li>
            <li>Tickets are non-transferable and non-refundable unless the event is cancelled or rescheduled.</li>
            <li>Re-entry is not permitted once you leave the venue.</li>
          </ul>
        </section>
        <section>
          <h2 className="font-display text-[10.5pt] font-bold">Need help?</h2>
          <dl className="mt-[2mm] space-y-[1.5mm] text-[#3D3A5C]">
            <div>
              <dt className="text-[7pt] text-[#5F5C7E]">Email</dt>
              <dd className="font-medium text-[#1E1B3A]">hello@dreamcraft.dev</dd>
            </div>
            <div>
              <dt className="text-[7pt] text-[#5F5C7E]">Phone</dt>
              <dd className="font-medium text-[#1E1B3A]">+880 1700-000000</dd>
            </div>
            <div>
              <dt className="text-[7pt] text-[#5F5C7E]">Quote your booking reference</dt>
              <dd className="font-mono font-bold text-[#1E1B3A]">{b.code}</dd>
            </div>
          </dl>
        </section>
      </div>

      <p className="mt-[10mm] border-t-[0.3mm] border-[#E3E1EE] pt-[3mm] text-[6.5pt] text-[#8A87A6]">
        Issued by Dream Craft Events, House 12, Road 7, Dhanmondi, Dhaka 1205. This ticket is valid only with its QR code; altered or duplicated tickets will be refused entry.
      </p>
    </div>,
    document.body,
  );
}

function TicketField({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className={small ? "text-[6.5pt] text-[#8A87A6]" : "text-[7pt] text-[#5F5C7E]"}>{label}</dt>
      <dd className={small ? "mt-[0.5mm] font-medium break-words text-[#3D3A5C]" : "mt-[0.8mm] text-[10.5pt] leading-snug font-semibold"}>{value}</dd>
    </div>
  );
}
