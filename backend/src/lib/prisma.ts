import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

// A single shared client per process (each client owns a connection pool).
export const prisma = new PrismaClient({ adapter });
