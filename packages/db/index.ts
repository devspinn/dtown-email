import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

// Create Drizzle instance with connection string
export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

// For development with process.env
export const db = createDb(process.env.DATABASE_URL!);

// Export schema and types
export { schema };
export type {
  User,
  NewUser,
  Session,
  Account,
  EmailAccount,
  NewEmailAccount,
  Rule,
  NewRule,
  Email,
  NewEmail,
  ProcessedEmail,
  NewProcessedEmail,
} from "./schema";

// Re-export commonly used drizzle-orm query functions
export { eq, and, or, desc, asc, like, ilike, sql } from "drizzle-orm";
