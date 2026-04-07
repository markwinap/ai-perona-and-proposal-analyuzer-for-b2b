import { eq, sql } from "drizzle-orm";

import { db } from "~/server/db";
import { aiPromptVersions, apiMetrics, cacheMetrics } from "~/server/db/schema";

export const recordCacheAccess = async (params: {
  service: string;
  inputHash: string;
  hit: boolean;
}): Promise<void> => {
  try {
    await db
      .insert(cacheMetrics)
      .values({
        service: params.service,
        inputHash: params.inputHash,
        hitCount: params.hit ? 1 : 0,
        missCount: params.hit ? 0 : 1,
        lastAccessedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [cacheMetrics.service, cacheMetrics.inputHash],
        set: {
          hitCount: params.hit
            ? sql`${cacheMetrics.hitCount} + 1`
            : cacheMetrics.hitCount,
          missCount: params.hit
            ? cacheMetrics.missCount
            : sql`${cacheMetrics.missCount} + 1`,
          lastAccessedAt: new Date(),
        },
      });
  } catch {
    // Metrics writes must never block request path.
  }
};

export const recordApiMetric = async (params: {
  service: string;
  processingTimeMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalCost?: number;
  wasCache?: boolean;
  hadError?: boolean;
}): Promise<void> => {
  try {
    await db.insert(apiMetrics).values({
      service: params.service,
      processingTimeMs: params.processingTimeMs,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalCost:
        typeof params.totalCost === "number"
          ? params.totalCost.toFixed(6)
          : undefined,
      wasCache: !!params.wasCache,
      hadError: !!params.hadError,
      createdAt: new Date(),
    });
  } catch {
    // Metrics writes must never block request path.
  }
};

export const recordPromptVersionSnapshot = async (params: {
  promptId: number;
  promptTemplate: string;
  systemInstruction?: string | null;
  changeNotes?: string | null;
  isActive: boolean;
}): Promise<void> => {
  try {
    const latest = await db.query.aiPromptVersions.findFirst({
      where: eq(aiPromptVersions.promptId, params.promptId),
      orderBy: (table, helpers) => [helpers.desc(table.version)],
    });

    const nextVersion = (latest?.version ?? 0) + 1;

    await db.insert(aiPromptVersions).values({
      promptId: params.promptId,
      version: nextVersion,
      promptTemplate: params.promptTemplate,
      systemInstruction: params.systemInstruction ?? null,
      changeNotes: params.changeNotes ?? null,
      isActive: params.isActive,
      createdAt: new Date(),
    });
  } catch {
    // Version tracking should not block prompt updates.
  }
};

export const getApiMetricSummary = async (limit = 1000) => {
  const rows = await db.query.apiMetrics.findMany({
    orderBy: (table, helpers) => [helpers.desc(table.createdAt)],
    limit,
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.wasCache) {
        acc.cached += 1;
      }
      if (row.hadError) {
        acc.errors += 1;
      }
      return acc;
    },
    { total: 0, cached: 0, errors: 0 }
  );

  return {
    totals,
    hitRate: totals.total > 0 ? totals.cached / totals.total : 0,
    errorRate: totals.total > 0 ? totals.errors / totals.total : 0,
    recent: rows,
  };
};
