import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

// Create connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

// Create Drizzle instance
export const db = drizzle(pool, { schema });

// Export schema and types
export { schema };
export type { User, NewUser } from "./schema";
