import { createDb } from "@dtown-email/db";

type Env = {
  DATABASE_URL: string;
};

export const createContext = (env?: Env) => {
  // Use env.DATABASE_URL if available (Cloudflare Workers), otherwise fall back to process.env
  const dbUrl = env?.DATABASE_URL || process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  return {
    db,
  };
};

export type Context = ReturnType<typeof createContext>;
