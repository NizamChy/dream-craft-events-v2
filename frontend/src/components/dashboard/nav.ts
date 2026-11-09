import {
  CalendarCog,
  CalendarHeart,
  ClipboardList,
  Heart,
  Inbox,
  LayoutDashboard,
  Mail,
  Megaphone,
  Package,
  PartyPopper,
  ShoppingBag,
  Star,
  Ticket,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  /** Key in the badge counts object shown next to the label. */
  badge?: "customEventUpdates";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const ALL: Role[] = ["USER", "ORGANIZER", "ADMIN"];

export const DASHBOARD_NAV: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL }],
  },
  {
    title: "My activity",
    items: [
      { href: "/dashboard/my/bookings", label: "My tickets", icon: Ticket, roles: ALL },
      { href: "/dashboard/my/orders", label: "Shop orders", icon: ShoppingBag, roles: ALL },
      { href: "/dashboard/my/custom-events", label: "Custom events", icon: PartyPopper, roles: ALL, badge: "customEventUpdates" },
      { href: "/dashboard/my/wishlist", label: "Wishlist", icon: Heart, roles: ALL },
    ],
  },
  {
    title: "Organize",
    items: [
      { href: "/dashboard/manage/events", label: "My events", icon: CalendarCog, roles: ["ORGANIZER", "ADMIN"] },
      { href: "/dashboard/manage/bookings", label: "Ticket sales", icon: ClipboardList, roles: ["ORGANIZER", "ADMIN"] },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/dashboard/admin/users", label: "Users", icon: Users, roles: ["ADMIN"] },
      { href: "/dashboard/admin/organizer-requests", label: "Organizer requests", icon: UserCog, roles: ["ADMIN"] },
      { href: "/dashboard/admin/custom-events", label: "Custom event requests", icon: CalendarHeart, roles: ["ADMIN"] },
      { href: "/dashboard/admin/products", label: "Products", icon: Package, roles: ["ADMIN"] },
      { href: "/dashboard/admin/orders", label: "Orders", icon: ShoppingBag, roles: ["ADMIN"] },
      { href: "/dashboard/admin/reviews", label: "Reviews", icon: Star, roles: ["ADMIN"] },
      { href: "/dashboard/admin/messages", label: "Messages", icon: Inbox, roles: ["ADMIN"] },
      { href: "/dashboard/admin/subscribers", label: "Subscribers", icon: Mail, roles: ["ADMIN"] },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/dashboard/profile", label: "Profile & settings", icon: UserRound, roles: ALL },
      { href: "/dashboard/become-organizer", label: "Become an organizer", icon: Megaphone, roles: ["USER"] },
    ],
  },
];

export function navFor(role: Role): NavSection[] {
  return DASHBOARD_NAV.map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(role)) })).filter((s) => s.items.length);
}
