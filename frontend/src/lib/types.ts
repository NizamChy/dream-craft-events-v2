export type Role = "USER" | "ORGANIZER" | "ADMIN";
export type EventCategory =
  | "TECHNOLOGY"
  | "BUSINESS"
  | "MUSIC"
  | "ARTS"
  | "HEALTH"
  | "FOOD"
  | "EDUCATION"
  | "SPORTS"
  | "ENTERTAINMENT"
  | "OTHER";
export type TicketTier = "STANDARD" | "VIP";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";
export type OrderStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type GuestRange = "UP_TO_250" | "UP_TO_500" | "UP_TO_1000";
export type MediaPackage = "NONE" | "PHOTOGRAPHY" | "VIDEOGRAPHY" | "PHOTO_AND_VIDEO";

export interface Paginated<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  phone: string | null;
  avatar: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { bookings: number; orders: number; organizedEvents: number };
}

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string | null;
  role?: Role;
}

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: EventCategory;
  venue: string;
  city: string;
  startsAt: string;
  endsAt: string | null;
  image: string;
  speakers: string[];
  sponsors: string[];
  totalSeats: number;
  seatsSold: number;
  seatsLeft: number;
  standardPriceCents: number;
  vipPriceCents: number;
  isFeatured: boolean;
  isPublished: boolean;
  organizerId: string;
  organizer?: { id: string; firstName: string; lastName: string; avatar: string | null };
  createdAt: string;
  _count?: { bookings: number };
}

export interface EventSummary {
  id: string;
  slug: string;
  title: string;
  image: string;
  startsAt: string;
  venue: string;
  city: string;
  organizerId?: string;
}

export interface Booking {
  id: string;
  code: string;
  userId: string;
  eventId: string;
  tier: TicketTier;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  status: PaymentStatus;
  transactionId: string | null;
  paidAt: string | null;
  createdAt: string;
  event: EventSummary;
  user?: UserSummary;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  image: string;
  stock: number;
  isActive: boolean;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  image: string;
  priceCents: number;
  quantity: number;
}

export interface Order {
  id: string;
  code: string;
  userId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalCents: number;
  shippingAddress: string;
  phone: string;
  transactionId: string | null;
  paidAt: string | null;
  createdAt: string;
  items: OrderItem[];
  user?: UserSummary;
}

export interface CustomEventRequest {
  id: string;
  userId: string;
  eventType: string;
  eventDate: string;
  location: string;
  guestRange: GuestRange;
  mediaPackage: MediaPackage;
  catering: boolean;
  phone: string;
  notes: string | null;
  estimatedCostCents: number;
  status: RequestStatus;
  adminNote: string | null;
  seenByUser: boolean;
  createdAt: string;
  user?: UserSummary;
}

export interface OrganizerRequest {
  id: string;
  userId: string;
  company: string;
  experience: string;
  skills: string;
  message: string | null;
  status: RequestStatus;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user?: UserSummary;
}

export interface Review {
  id: string;
  userId: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  createdAt: string;
  user?: { firstName: string; lastName: string; avatar: string | null; role?: Role; email?: string };
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Subscriber {
  id: string;
  email: string;
  createdAt: string;
}

export interface WishlistItem {
  userId: string;
  eventId: string;
  createdAt: string;
  event: EventItem;
}
