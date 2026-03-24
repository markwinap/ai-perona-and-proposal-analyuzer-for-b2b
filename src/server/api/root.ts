import { companyRouter } from "~/server/api/routers/company";
import { personaRouter } from "~/server/api/routers/persona";
import { promptRouter } from "~/server/api/routers/prompt";
import { proposalRouter } from "~/server/api/routers/proposal";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  company: companyRouter,
  persona: personaRouter,
  proposal: proposalRouter,
  prompt: promptRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
