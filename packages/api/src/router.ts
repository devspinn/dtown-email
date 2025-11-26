import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { type Context } from "./context";
import { schema } from "@dtown-email/db";

const t = initTRPC.context<Context>().create();

export const appRouter = t.router({
  hello: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => `Hello ${input.name}`),

  users: t.router({
    list: t.procedure.query(async ({ ctx }) => {
      const users = await ctx.db.select().from(schema.user);
      return users;
    }),

    create: t.procedure
      .input(
        z.object({
          email: z.string().email(),
          name: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const [newUser] = await ctx.db
          .insert(schema.user)
          .values(input)
          .returning();
        return newUser;
      }),
  }),
});

export type AppRouter = typeof appRouter;
