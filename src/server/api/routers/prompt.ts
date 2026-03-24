import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { aiPrompts } from "~/server/db/schema";
import { DEFAULT_PROMPTS, type PromptKey } from "~/server/services/prompt-defaults";

const PROMPT_KEYS = ["persona_analysis", "rfp_analysis", "proposal_draft"] as const;

export const promptRouter = createTRPCRouter({
    list: publicProcedure.query(async ({ ctx }) => {
        const stored = await ctx.db.query.aiPrompts.findMany({
            orderBy: (table, helpers) => [helpers.asc(table.key)],
        });

        return PROMPT_KEYS.map((key) => {
            const record = stored.find((r) => r.key === key);
            const defaults = DEFAULT_PROMPTS[key];
            return {
                id: record?.id ?? null,
                key,
                name: record?.name ?? defaults.name,
                description: record?.description ?? defaults.description,
                systemInstruction:
                    record?.systemInstruction ?? defaults.systemInstruction ?? null,
                promptTemplate: record?.promptTemplate ?? defaults.promptTemplate,
                isActive: record?.isActive ?? true,
                isCustomized: !!record,
                createdAt: record?.createdAt ?? null,
                updatedAt: record?.updatedAt ?? null,
            };
        });
    }),

    getByKey: publicProcedure
        .input(z.object({ key: z.enum(PROMPT_KEYS) }))
        .query(async ({ ctx, input }) => {
            const record = await ctx.db.query.aiPrompts.findFirst({
                where: eq(aiPrompts.key, input.key),
            });

            const defaults = DEFAULT_PROMPTS[input.key as PromptKey];

            return {
                systemInstruction:
                    record?.systemInstruction ?? defaults.systemInstruction ?? null,
                promptTemplate: record?.promptTemplate ?? defaults.promptTemplate,
            };
        }),

    upsert: publicProcedure
        .input(
            z.object({
                key: z.enum(PROMPT_KEYS),
                name: z.string().min(2).max(255),
                description: z.string().optional(),
                systemInstruction: z.string().optional(),
                promptTemplate: z.string().min(10),
                isActive: z.boolean().default(true),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.query.aiPrompts.findFirst({
                where: eq(aiPrompts.key, input.key),
            });

            if (existing) {
                const [updated] = await ctx.db
                    .update(aiPrompts)
                    .set({
                        name: input.name,
                        description: input.description,
                        systemInstruction: input.systemInstruction,
                        promptTemplate: input.promptTemplate,
                        isActive: input.isActive,
                        updatedAt: new Date(),
                    })
                    .where(eq(aiPrompts.id, existing.id))
                    .returning();

                return updated;
            }

            const [inserted] = await ctx.db
                .insert(aiPrompts)
                .values({
                    key: input.key,
                    name: input.name,
                    description: input.description,
                    systemInstruction: input.systemInstruction,
                    promptTemplate: input.promptTemplate,
                    isActive: input.isActive,
                })
                .returning();

            return inserted;
        }),

    resetToDefault: publicProcedure
        .input(z.object({ key: z.enum(PROMPT_KEYS) }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db
                .delete(aiPrompts)
                .where(eq(aiPrompts.key, input.key));

            return { key: input.key, reset: true };
        }),
});
