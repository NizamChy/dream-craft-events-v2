import Link from "next/link";
import { TableCard } from "@/components/dashboard/page-heading";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney, fullName } from "@/lib/format";
import { Ticket } from "lucide-react";

export interface RecentBooking {
  id: string;
  code: string;
  tier: "STANDARD" | "VIP";
  quantity: number;
  totalCents: number;
  paidAt: string | null;
  createdAt: string;
  event: { id: string; title: string; slug: string };
  user: { firstName: string; lastName: string; email: string };
}

export function RecentBookings({ items }: { items: RecentBooking[] }) {
  if (!items.length) {
    return <EmptyState icon={Ticket} title="No ticket sales yet" description="Paid bookings will show up here as soon as they come in." />;
  }
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Event</TableHead>
            <TableHead className="hidden sm:table-cell">Tickets</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="hidden md:table-cell text-right">Paid on</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((b) => (
            <TableRow key={b.id}>
              <TableCell>
                <p className="font-medium">{fullName(b.user)}</p>
                <p className="text-xs text-muted-foreground">{b.user.email}</p>
              </TableCell>
              <TableCell className="max-w-48">
                <Link href={`/events/${b.event.slug}`} className="line-clamp-1 hover:text-primary hover:underline">
                  {b.event.title}
                </Link>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {b.quantity} × {b.tier === "VIP" ? "VIP" : "Standard"}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatMoney(b.totalCents)}</TableCell>
              <TableCell className="hidden md:table-cell text-right text-muted-foreground">{formatDate(b.paidAt ?? b.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}
