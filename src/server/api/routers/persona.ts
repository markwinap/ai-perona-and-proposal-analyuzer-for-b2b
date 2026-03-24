import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  aiPrompts,
  communicationTypeEnum,
  personaCommunications,
  personas,
  proposals,
} from "~/server/db/schema";
import { analyzePersonaWithAI } from "~/server/services/persona-analysis";
import { DEFAULT_PROMPTS } from "~/server/services/prompt-defaults";
import { translateTextToSpanishLatam } from "~/server/services/translation";

export const personaRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          companyId: z.number().int().positive().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.query.personas.findMany({
        where: input?.companyId
          ? eq(personas.companyId, input.companyId)
          : undefined,
        orderBy: (table, helpers) => [helpers.asc(table.fullName)],
        with: {
          company: true,
        },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        fullName: z.string().min(2),
        email: z.string().email().optional().or(z.literal("")),
        jobDescription: z.string().optional(),
        personalitySummary: z.string().optional(),
        personalPreferences: z.string().optional(),
        pastExperiences: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [inserted] = await ctx.db
        .insert(personas)
        .values({
          companyId: input.companyId,
          fullName: input.fullName,
          email: input.email || null,
          jobDescription: input.jobDescription,
          personalitySummary: input.personalitySummary,
          personalPreferences: input.personalPreferences,
          pastExperiences: input.pastExperiences,
        })
        .returning();

      return inserted;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        fullName: z.string().min(2),
        email: z.string().email().optional().or(z.literal("")),
        jobDescription: z.string().optional(),
        personalitySummary: z.string().optional(),
        personalPreferences: z.string().optional(),
        pastExperiences: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(personas)
        .set({
          fullName: input.fullName,
          email: input.email || null,
          jobDescription: input.jobDescription,
          personalitySummary: input.personalitySummary,
          personalPreferences: input.personalPreferences,
          pastExperiences: input.pastExperiences,
          updatedAt: new Date(),
        })
        .where(eq(personas.id, input.id))
        .returning();

      return updated;
    }),

  addCommunication: publicProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        personaId: z.number().int().positive(),
        type: z.enum(communicationTypeEnum.enumValues),
        subject: z.string().optional(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [inserted] = await ctx.db
        .insert(personaCommunications)
        .values({
          companyId: input.companyId,
          personaId: input.personaId,
          type: input.type,
          subject: input.subject,
          content: input.content,
        })
        .returning();

      return inserted;
    }),

  listCommunications: publicProcedure
    .input(
      z
        .object({
          personaId: z.number().int().positive().optional(),
          companyId: z.number().int().positive().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.query.personaCommunications.findMany({
        where: (table, operators) => {
          const filters = [];
          if (input?.personaId) {
            filters.push(operators.eq(table.personaId, input.personaId));
          }
          if (input?.companyId) {
            filters.push(operators.eq(table.companyId, input.companyId));
          }
          if (filters.length === 0) {
            return undefined;
          }
          return operators.and(...filters);
        },
        orderBy: [desc(personaCommunications.createdAt)],
        with: {
          persona: true,
          company: true,
        },
      });
    }),

  analyze: publicProcedure
    .input(
      z.object({
        personaId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const persona = await ctx.db.query.personas.findFirst({
        where: eq(personas.id, input.personaId),
        with: {
          company: true,
          communications: {
            orderBy: [desc(personaCommunications.createdAt)],
            limit: 30,
          },
        },
      });

      if (!persona) {
        throw new Error("Persona not found");
      }

      const proposalHistory = await ctx.db.query.proposals.findMany({
        where: eq(proposals.companyId, persona.companyId),
        orderBy: [desc(proposals.createdAt)],
        limit: 25,
      });

      const promptRecord = await ctx.db.query.aiPrompts.findFirst({
        where: eq(aiPrompts.key, "persona_analysis"),
      });

      const promptOverride = {
        promptTemplate: promptRecord?.promptTemplate ?? DEFAULT_PROMPTS.persona_analysis.promptTemplate,
        systemInstruction:
          promptRecord?.systemInstruction ?? DEFAULT_PROMPTS.persona_analysis.systemInstruction,
      };

      const analysis = await analyzePersonaWithAI({
        fullName: persona.fullName,
        companyName: persona.company.name,
        jobDescription: persona.jobDescription,
        personalitySummary: persona.personalitySummary,
        personalPreferences: persona.personalPreferences,
        pastExperiences: persona.pastExperiences,
        communications: persona.communications.map((item) => ({
          type: item.type,
          subject: item.subject,
          content: item.content,
          occurredAt: item.occurredAt,
        })),
        companySignals: {
          businessIntent: persona.company.businessIntent,
          technologyIntent: persona.company.technologyIntent,
          developmentStacks: persona.company.developmentStacks,
          certifications: persona.company.certifications,
          standards: persona.company.standards,
          partnerships: persona.company.partnerships,
          referenceArchitectures: persona.company.referenceArchitectures,
          engineeringGuidelines: persona.company.engineeringGuidelines,
        },
        proposalHistory: proposalHistory.map((proposal) => ({
          title: proposal.title,
          outcome: proposal.outcome,
          status: proposal.status,
          summary: proposal.summary,
          intentSignals: proposal.intentSignals,
          technologyFit: proposal.technologyFit,
          outcomeReason: proposal.outcomeReason,
        })),
      }, promptOverride);

      // Save analysis to database
      const now = new Date();
      await ctx.db
        .update(personas)
        .set({
          analysis,
          aiProvider: "google_gemini",
          analysisGeneratedAt: now,
          updatedAt: now,
        })
        .where(eq(personas.id, input.personaId));

      return {
        personaId: persona.id,
        personaName: persona.fullName,
        companyName: persona.company.name,
        analysis,
        generatedAt: now,
      };
    }),

  translateAnalysis: publicProcedure
    .input(
      z.object({
        analysis: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const translatedAnalysis = await translateTextToSpanishLatam(input.analysis);

      return {
        translatedAnalysis,
      };
    }),
});
