import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getApiMetricSummary } from "~/server/services/ai-metrics";
import { getResponseCacheStats } from "~/server/services/response-cache";

export const metricsRouter = createTRPCRouter({
  getCacheStats: publicProcedure.query(async ({ ctx }) => {
    const inMemory = getResponseCacheStats();
    const persisted = await ctx.db.query.cacheMetrics.findMany({
      orderBy: (table, helpers) => [helpers.desc(table.lastAccessedAt)],
      limit: 200,
    });

    return {
      inMemory,
      persisted,
    };
  }),

  getApiMetrics: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(2000).default(1000) }).optional())
    .query(async ({ input }) => {
      return getApiMetricSummary(input?.limit ?? 1000);
    }),

  getDashboard: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(2000).default(1000) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 1000;
      const [cacheStats, apiSummary, promptVersions] = await Promise.all([
        ctx.db.query.cacheMetrics.findMany({
          orderBy: (table, helpers) => [helpers.desc(table.lastAccessedAt)],
          limit: 200,
        }),
        getApiMetricSummary(limit),
        ctx.db.query.aiPromptVersions.findMany({
          orderBy: (table, helpers) => [helpers.desc(table.createdAt)],
          limit: 50,
        }),
      ]);

      const cachedCalls = apiSummary.totals.cached;
      const totalCalls = apiSummary.totals.total;
      const estimatedSavings = cachedCalls * 2500 * 0.000075;

      return {
        generatedAt: new Date(),
        cache: {
          inMemory: getResponseCacheStats(),
          persisted: cacheStats,
        },
        api: apiSummary,
        promptVersions,
        savings: {
          cachedCalls,
          totalCalls,
          hitRate: totalCalls > 0 ? cachedCalls / totalCalls : 0,
          estimatedSavings,
        },
      };
    }),
});
