import { desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { aiProviderConfigs, aiProviderEnum } from "~/server/db/schema";

export const aiProviderRouter = createTRPCRouter({
  supported: publicProcedure.query(() => {
    return aiProviderEnum.enumValues;
  }),

  listConfigs: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.aiProviderConfigs.findMany({
      orderBy: [desc(aiProviderConfigs.createdAt)],
      with: {
        company: true,
      },
    });
  }),

  upsertGlobalConfig: publicProcedure
    .input(
      z.object({
        provider: z.enum(aiProviderEnum.enumValues),
        modelName: z.string().optional(),
        endpoint: z.string().optional(),
        apiVersion: z.string().optional(),
        isDefault: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.isDefault) {
        await ctx.db
          .update(aiProviderConfigs)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(isNull(aiProviderConfigs.companyId));
      }

      const existing = await ctx.db.query.aiProviderConfigs.findFirst({
        where: (table, operators) =>
          operators.and(
            operators.isNull(table.companyId),
            operators.eq(table.provider, input.provider)
          ),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(aiProviderConfigs)
          .set({
            modelName: input.modelName,
            endpoint: input.endpoint,
            apiVersion: input.apiVersion,
            isDefault: input.isDefault,
            updatedAt: new Date(),
          })
          .where(eq(aiProviderConfigs.id, existing.id))
          .returning();

        return updated;
      }

      const [inserted] = await ctx.db
        .insert(aiProviderConfigs)
        .values({
          companyId: null,
          provider: input.provider,
          modelName: input.modelName,
          endpoint: input.endpoint,
          apiVersion: input.apiVersion,
          isDefault: input.isDefault,
        })
        .returning();

      return inserted;
    }),

  upsertCompanyConfig: publicProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        provider: z.enum(aiProviderEnum.enumValues),
        modelName: z.string().optional(),
        endpoint: z.string().optional(),
        apiVersion: z.string().optional(),
        isDefault: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.isDefault) {
        await ctx.db
          .update(aiProviderConfigs)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(aiProviderConfigs.companyId, input.companyId));
      }

      const existing = await ctx.db.query.aiProviderConfigs.findFirst({
        where: (table, operators) =>
          operators.and(
            operators.eq(table.companyId, input.companyId),
            operators.eq(table.provider, input.provider)
          ),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(aiProviderConfigs)
          .set({
            modelName: input.modelName,
            endpoint: input.endpoint,
            apiVersion: input.apiVersion,
            isDefault: input.isDefault,
            updatedAt: new Date(),
          })
          .where(eq(aiProviderConfigs.id, existing.id))
          .returning();

        return updated;
      }

      const [inserted] = await ctx.db
        .insert(aiProviderConfigs)
        .values({
          companyId: input.companyId,
          provider: input.provider,
          modelName: input.modelName,
          endpoint: input.endpoint,
          apiVersion: input.apiVersion,
          isDefault: input.isDefault,
        })
        .returning();

      return inserted;
    }),
});
