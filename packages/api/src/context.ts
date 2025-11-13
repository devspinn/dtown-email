import { db } from "@yieldplat/db";

export const createContext = () => {
  return {
    db,
  };
};

export type Context = ReturnType<typeof createContext>;
