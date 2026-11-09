/** Fields that are safe to send to clients (never includes passwordHash). */
export const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  phone: true,
  avatar: true,
  address: true,
  city: true,
  country: true,
  bio: true,
  isActive: true,
  createdAt: true,
} as const;

export const DEMO_ACCOUNTS = {
  ADMIN: "admin@dreamcraft.dev",
  ORGANIZER: "organizer@dreamcraft.dev",
  USER: "user@dreamcraft.dev",
} as const;
