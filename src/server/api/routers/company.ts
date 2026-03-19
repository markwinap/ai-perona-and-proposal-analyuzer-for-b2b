import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { companies } from "~/server/db/schema";

const csvToArray = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

export const companyRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.companies.findMany({
      orderBy: (table, helpers) => [helpers.asc(table.name)],
    });
  }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(2),
        industry: z.string().optional(),
        businessIntent: z.string().optional(),
        technologyIntent: z.string().optional(),
        developmentStacks: z.string().optional(),
        certifications: z.string().optional(),
        standards: z.string().optional(),
        partnerships: z.string().optional(),
        referenceArchitectures: z.string().optional(),
        engineeringGuidelines: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [inserted] = await ctx.db
        .insert(companies)
        .values({
          name: input.name,
          industry: input.industry,
          businessIntent: input.businessIntent,
          technologyIntent: input.technologyIntent,
          developmentStacks: csvToArray(input.developmentStacks),
          certifications: csvToArray(input.certifications),
          standards: csvToArray(input.standards),
          partnerships: csvToArray(input.partnerships),
          referenceArchitectures: csvToArray(input.referenceArchitectures),
          engineeringGuidelines: csvToArray(input.engineeringGuidelines),
        })
        .returning();

      return inserted;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(2),
        industry: z.string().optional(),
        businessIntent: z.string().optional(),
        technologyIntent: z.string().optional(),
        developmentStacks: z.string().optional(),
        certifications: z.string().optional(),
        standards: z.string().optional(),
        partnerships: z.string().optional(),
        referenceArchitectures: z.string().optional(),
        engineeringGuidelines: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(companies)
        .set({
          name: input.name,
          industry: input.industry,
          businessIntent: input.businessIntent,
          technologyIntent: input.technologyIntent,
          developmentStacks: csvToArray(input.developmentStacks),
          certifications: csvToArray(input.certifications),
          standards: csvToArray(input.standards),
          partnerships: csvToArray(input.partnerships),
          referenceArchitectures: csvToArray(input.referenceArchitectures),
          engineeringGuidelines: csvToArray(input.engineeringGuidelines),
          updatedAt: new Date(),
        })
        .where(eq(companies.id, input.id))
        .returning();

      return updated;
    }),
});
